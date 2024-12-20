import { Button, Callout, Flex, Select, TextArea } from "@radix-ui/themes";
import {
	type FC,
	useCallback,
	useContext,
	useLayoutEffect,
	useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { ExtensionInjectPoint } from "../../components/ExtensionInjectPoint/index.tsx";
import { TTMLImportDialog } from "../../components/TTMLImportDialog/index.tsx";
import { db } from "../../dexie.ts";
import { Option } from "./common.tsx";
import { SongContext } from "./song-ctx.ts";

export const LyricTabContent: FC = () => {
	const song = useContext(SongContext);
	const [lyricFormat, setLyricFormat] = useState("none");
	const [lyricContent, setLyricContent] = useState("");
	const [translatedLyricContent, setTranslatedLyricContent] = useState("");
	const [romanLyricContent, setRomanLyricContent] = useState("");
	const { t } = useTranslation();

	useLayoutEffect(() => {
		if (song) {
			setLyricFormat(song.lyricFormat);
			setLyricContent(song.lyric);
		} else {
			setLyricFormat("none");
			setLyricContent("");
		}
	}, [song]);

	const saveData = useCallback(
		(
			saveLyricFormat: string,
			saveLyricContent: string,
			saveTranslatedLyricContent: string,
			saveRomanLyricContent: string,
		) => {
			if (song === undefined) return;
			db.songs.update(song, (song) => {
				song.lyric = saveLyricFormat;
				if (saveLyricFormat === "none") {
					song.lyricFormat = "none";
					song.lyric = "";
					song.translatedLrc = "";
					song.romanLrc = "";
					setLyricFormat("none");
					setLyricContent("");
					setTranslatedLyricContent("");
					setRomanLyricContent("");
					return;
				}
				if (saveLyricFormat === "ttml") {
					song.lyricFormat = "ttml";
					song.lyric = saveLyricContent;
					song.translatedLrc = "";
					song.romanLrc = "";
					setLyricFormat("ttml");
					setLyricContent(saveLyricContent);
					setTranslatedLyricContent("");
					setRomanLyricContent("");
					return;
				}
				song.lyricFormat = saveLyricFormat;
				song.lyric = saveLyricContent;
				song.translatedLrc = saveTranslatedLyricContent;
				song.romanLrc = saveRomanLyricContent;
				setLyricFormat(saveLyricFormat);
				setLyricContent(saveLyricContent);
				setTranslatedLyricContent(saveTranslatedLyricContent);
				setRomanLyricContent(saveRomanLyricContent);
			});
		},
		[song],
	);

	return (
		<>
			<ExtensionInjectPoint injectPointName="page.song.tab.lyric.before" />
			<Flex direction="column" gap="4">
				<Option label={t("page.song.lyric.lyricFormatLabel", "歌词格式")}>
					<Select.Root
						defaultValue="none"
						value={lyricFormat}
						onValueChange={(v) => setLyricFormat(v)}
					>
						<Select.Trigger />
						<Select.Content>
							<Select.Item value="none">
								<Trans i18nKey="page.song.lyric.lyricFormat.none">无歌词</Trans>
							</Select.Item>
							<Select.Item value="lrc">
								<Trans i18nKey="page.song.lyric.lyricFormat.lrc">
									LyRiC 歌词
								</Trans>
							</Select.Item>
							<Select.Item value="eslrc">
								<Trans i18nKey="page.song.lyric.lyricFormat.eslrc">
									ESLyRiC 歌词
								</Trans>
							</Select.Item>
							<Select.Item value="yrc">
								<Trans i18nKey="page.song.lyric.lyricFormat.yrc">
									YRC 歌词
								</Trans>
							</Select.Item>
							<Select.Item value="qrc">
								<Trans i18nKey="page.song.lyric.lyricFormat.qrc">
									QRC 歌词
								</Trans>
							</Select.Item>
							<Select.Item value="lys">
								<Trans i18nKey="page.song.lyric.lyricFormat.lys">
									Lyricify Syllable 歌词
								</Trans>
							</Select.Item>
							<Select.Item value="ttml">
								<Trans i18nKey="page.song.lyric.lyricFormat.ttml">
									TTML 歌词
								</Trans>
							</Select.Item>
						</Select.Content>
					</Select.Root>
				</Option>
				{lyricFormat !== "none" && lyricFormat.length > 0 && (
					<>
						<Option label={t("page.song.lyric.lyricData", "歌词数据")}>
							<TextArea
								value={lyricContent}
								style={{
									minHeight: "10rem",
								}}
								onChange={(v) => setLyricContent(v.currentTarget.value)}
							/>
						</Option>

						{lyricFormat === "ttml" ? (
							<Callout.Root>
								<Callout.Text>
									<Trans i18nKey="page.song.lyric.ttmlLyricTip">
										TTML 歌词可同时包含翻译与音译数据。
									</Trans>
								</Callout.Text>
							</Callout.Root>
						) : (
							<>
								<Option
									label={t(
										"page.song.lyric.translationLyricData",
										"翻译歌词数据",
									)}
								>
									<Callout.Root>
										<Callout.Text>
											<Trans i18nKey="page.song.lyric.translationLyricDataTip">
												请提供 LyRiC
												格式的歌词数据，将会根据时间戳与一致或靠近的原文歌词配对成为译文
											</Trans>
										</Callout.Text>
									</Callout.Root>
									<TextArea
										value={translatedLyricContent}
										style={{
											minHeight: "10rem",
										}}
										onChange={(v) =>
											setTranslatedLyricContent(v.currentTarget.value)
										}
									/>
								</Option>

								<Option label="音译歌词数据">
									<Callout.Root>
										<Callout.Text>
											<Trans i18nKey="page.song.lyric.romanLyricDataTip">
												请提供 LyRiC
												格式的歌词数据，将会根据时间戳与一致或靠近的原文歌词配对成为音译
											</Trans>
										</Callout.Text>
									</Callout.Root>
									<TextArea
										value={romanLyricContent}
										style={{
											minHeight: "10rem",
										}}
										onChange={(v) =>
											setRomanLyricContent(v.currentTarget.value)
										}
									/>
								</Option>
							</>
						)}
					</>
				)}
				<TTMLImportDialog
					defaultValue={song ? `${song.songArtists} - ${song.songName}` : ""}
					onSelectedLyric={(ttmlContent) => {
						saveData("ttml", ttmlContent, "", "");
					}}
				/>
			</Flex>
			<Button
				mt="4"
				onClick={() =>
					saveData(
						lyricFormat,
						lyricContent,
						translatedLyricContent,
						romanLyricContent,
					)
				}
			>
				<Trans i18nKey="common.dialog.save">保存</Trans>
			</Button>
			<ExtensionInjectPoint injectPointName="page.song.tab.lyric.after" />
		</>
	);
};
