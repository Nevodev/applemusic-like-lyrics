import { build, serve } from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import { glsl } from "esbuild-plugin-glsl";
import svgrPlugin from "esbuild-plugin-svgr";
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import manifest from "./manifest.json" assert { type: "json" };

let entryPoints = [
	"src/index.tsx",
	"src/worker_script.ts",
	"src/startup_script.ts",
	"src/index.sass",
];

const IS_DEV = process.argv.includes("--dev");

function getCommitHash() {
	try {
		return execSync("git rev-parse HEAD", { stdio: "pipe" })
			.toString("utf8")
			.trim();
	} catch (err) {
		console.warn("警告：获取 Git Commit Hash 失败", err);
		return "";
	}
}

function getBranchName() {
	try {
		return execSync("git branch --show-current", { stdio: "pipe" })
			.toString("utf8")
			.trim();
	} catch (err) {
		console.warn("警告：获取 Git Branch Name 失败", err);
		return "";
	}
}

execSync("wasm-pack build --target web", {
	cwd: "./amll-fft",
	stdio: "inherit",
});

manifest.commit = getCommitHash();
manifest.branch = getBranchName();

/** @type {import("esbuild").Plugin[]}*/
const plugins = [
	sassPlugin(),
	svgrPlugin(),
	{
		name: "esbuild-embbed-wasm",
		setup: (build) => {
			const WASM_EMBEDDED_NAMESPACE = "wasm-embedded";
			// Catch "*.wasm" files in the resolve phase and redirect them to our custom namespaces
			build.onResolve({ filter: /\.(?:wasm)$/ }, (args) => {
				// Ignore unresolvable paths
				if (args.resolveDir === "") return;

				// Redirect to the virtual module namespace
				return {
					path: path.isAbsolute(args.path)
						? args.path
						: path.join(args.resolveDir, args.path),
					namespace: WASM_EMBEDDED_NAMESPACE,
				};
			});

			// For embedded file loading, get the wasm binary data and pass it to esbuild's built-in `binary` loader
			build.onLoad(
				{ filter: /.*/, namespace: WASM_EMBEDDED_NAMESPACE },
				async (args) => ({
					contents: `
					const WASM_BASE64_DATA = "${(
						await fs.promises.readFile(args.path)
					).toString("base64")}";
					const WASM_DATA = Uint8Array.from(atob(WASM_BASE64_DATA), c => c.charCodeAt(0));
					export default WASM_DATA;
					`,
					loader: "js",
				}),
			);
		},
	},
	glsl({
		minify: !IS_DEV,
	}),
];

function getDefaultBetterNCMPath() {
	if (os.type() === "Windows_NT") {
		return "C:/betterncm";
	} else if (os.type() === "Darwin") {
		return path.resolve(os.userInfo().homedir, ".betterncm");
	}
	return "./betterncm";
}

const betterncmUserPath =
	process.env["BETTERNCM_PROFILE"] || getDefaultBetterNCMPath();
let devPath = path.resolve(
	betterncmUserPath,
	"plugins_dev",
	manifest.slug || manifest.name,
);

if (process.argv.includes("--style-only")) {
	entryPoints = ["src/index.sass"];
}

if (process.argv.includes("--lyric-test")) {
	entryPoints = ["src/lyric-test.tsx", "src/index.sass"];
}

/** @type {import("esbuild").BuildOptions} */
const buildOption = {
	entryPoints,
	bundle: true,
	// sourcemap: IS_DEV ? "inline" : false,
	sourcemap: false,
	legalComments: "external",
	minify: !IS_DEV,
	outdir: process.argv.includes("--dist") ? "dist" : devPath,
	target: "safari11",
	logOverride: {
		"empty-import-meta": "silent",
	},
	charset: "utf8",
	define: {
		DEBUG: IS_DEV.toString(),
		OPEN_PAGE_DIRECTLY: process.argv
			.includes("--open-page-directly")
			.toString(),
	},
	watch: process.argv.includes("--watch")
		? {
				onRebuild(err, result) {
					console.log("Rebuilding");
					if (err) {
						console.warn(err.message);
					} else if (result) {
						console.log("Build success");
					}
				},
		  }
		: undefined,
	plugins,
};

console.log("Building plugin to", buildOption.outdir);

if (IS_DEV && process.argv.includes("--lyric-test")) {
	serve({}, buildOption).then((result) => {
		console.log(`Dev Server is listening on ${result.host}:${result.port}`);
	});
} else {
	build(buildOption)
		.then((result) => {
			if (result.errors.length > 0) {
				console.log("Build Failed");
				return;
			}
			console.log("Build success");

			if (!process.argv.includes("--dist")) {
				if (!fs.existsSync(devPath)) {
					fs.mkdirSync(devPath, {
						recursive: true,
					});
				}
				let shouldOverwriteManifest = true;
				const curData = JSON.stringify(manifest, null, "\t");
				if (fs.existsSync(path.resolve(devPath, "manifest.json"))) {
					const data = fs.readFileSync(path.resolve(devPath, "manifest.json"), {
						encoding: "utf8",
					});
					shouldOverwriteManifest = curData !== data;
				}
				if (shouldOverwriteManifest) {
					fs.writeFileSync(path.resolve(devPath, "manifest.json"), curData, {
						encoding: "utf8",
					});
				}
			}

			if (process.argv.includes("--dist")) {
				console.log("Packing plugin");
				const plugin = new JSZip();
				function addIfExist(filename, name = filename) {
					if (fs.existsSync(filename))
						plugin.file(name, fs.readFileSync(filename));
				}
				if (process.argv.includes("--dist")) {
					addIfExist("dist/manifest.json", "manifest.json");
					addIfExist("dist/index.js", "index.js");
					addIfExist("dist/worker_script.js", "worker_script.js");
					addIfExist("dist/index.css", "index.css");
					addIfExist("dist/startup_script.js", "startup_script.js");
				} else {
					addIfExist("manifest.json");
					addIfExist("index.js");
					addIfExist("index.css");
					addIfExist("startup_script.js");
					addIfExist("worker_script.js");
				}
				plugin
					.generateAsync({
						compression: "DEFLATE",
						type: "nodebuffer",
						compressionOptions: {
							level: 9,
						},
					})
					.then((data) => {
						if (data.byteLength > 800 * 1024) {
							console.log("Plugin Artifact is too big (>800KiB)");
							return;
						}
						console.log(
							"Plugin packed successfully (",
							data.byteLength / 1024,
							"KiB )",
						);
						fs.writeFileSync("Apple Music-like lyrics.plugin", data);
						fs.writeFileSync(
							"Apple Music-like lyrics-${getCommitHash()}.plugin",
							data,
						);
						fs.writeFileSync(
							"dist/manifest.json",
							JSON.stringify(manifest, null, "\t"),
						);
					});
			}
		})
		.catch((error) => {
			console.log("Build Failed", error);
		});
}
