import { ArrowLeftIcon, PlayIcon, PlusIcon } from "@radix-ui/react-icons";
import {
	Avatar,
	Box,
	Button,
	Card,
	Container,
	ContextMenu,
	Flex,
	Heading,
	IconButton,
	Skeleton,
	Text,
} from "@radix-ui/themes";
import { path } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";
import { useLiveQuery } from "dexie-react-hooks";
import md5 from "md5";
import {
	type CSSProperties,
	type FC,
	type HTMLProps,
	forwardRef,
	useCallback,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import { type Song, db } from "../../dexie";
import { emitAudioThread, readLocalMusicMetadata } from "../../utils/player";
import { useSongCover } from "../../utils/use-song-cover";

export type Loadable<Value> =
	| {
			state: "loading";
	  }
	| {
			state: "hasError";
			error: unknown;
	  }
	| {
			state: "hasData";
			data: Awaited<Value>;
	  };

function toDuration(duration: number) {
	const isRemainTime = duration < 0;

	const d = Math.abs(duration | 0);
	const sec = d % 60;
	const min = Math.floor((d - sec) / 60);
	const secText = "0".repeat(2 - sec.toString().length) + sec;

	return `${isRemainTime ? "-" : ""}${min}:${secText}`;
}

export const SongCard: FC<{
	songId: string;
	songIndex: number;
	onPlayList: (songIndex: number) => void;
	onDeleteSong: (songId: string) => void;
	style?: CSSProperties;
}> = ({ songId, songIndex, onPlayList, onDeleteSong, style }) => {
	const song: Loadable<Song> = useLiveQuery(
		() =>
			db.songs.get(songId).then((data) => {
				if (!data) {
					return {
						state: "hasError",
						error: new Error(`未找到歌曲 ID ${songId}`),
					};
				}
				return {
					state: "hasData",
					data: data,
				};
			}),
		[songId],
		{
			state: "loading",
		},
	);
	const songImgUrl = useSongCover(
		song.state === "hasData" ? song.data : undefined,
	);
	const navigate = useNavigate();

	return (
		<Skeleton
			style={style}
			key={`song-card-${songId}`}
			loading={song.state === "loading"}
		>
			<Box py="4" pr="4" style={style}>
				<ContextMenu.Root>
					<ContextMenu.Trigger>
						<Card>
							<Flex p="1" align="center" gap="4">
								<Avatar size="5" fallback={<div />} src={songImgUrl} />
								<Flex
									direction="column"
									justify="center"
									flexGrow="1"
									minWidth="0"
								>
									<Text wrap="nowrap" truncate>
										{song.state === "hasData" &&
											(song.data.songName ||
												song.data.filePath ||
												`未知歌曲 ID ${songId}`)}
									</Text>
									<Text wrap="nowrap" truncate color="gray">
										{song.state === "hasData" && (song.data.songArtists || "")}
									</Text>
								</Flex>
								<Text wrap="nowrap">
									{song.state === "hasData" &&
										(song.data.duration ? toDuration(song.data.duration) : "")}
								</Text>
								<IconButton
									variant="ghost"
									onClick={() => onPlayList(songIndex)}
								>
									<PlayIcon />
								</IconButton>
							</Flex>
						</Card>
					</ContextMenu.Trigger>
					<ContextMenu.Content>
						<ContextMenu.Item onClick={() => onPlayList(songIndex)}>
							播放音乐
						</ContextMenu.Item>
						<ContextMenu.Item onClick={() => navigate(`/song/${songId}`)}>
							编辑音乐数据
						</ContextMenu.Item>
						<ContextMenu.Separator />
						<ContextMenu.Item color="red" onClick={() => onDeleteSong(songId)}>
							从歌单中删除
						</ContextMenu.Item>
					</ContextMenu.Content>
				</ContextMenu.Root>
			</Box>
		</Skeleton>
	);
};

const BOTTOM_PADDING = 150;

const PlaylistViewInner = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
	({ style, ...rest }, ref) => (
		<div
			ref={ref}
			style={{
				...style,
				height: `${(Number.parseFloat(style?.height?.toString() || "") || 0) + BOTTOM_PADDING}px`,
			}}
			{...rest}
		/>
	),
);

export const PlaylistPage: FC = () => {
	const param = useParams();
	const playlist = useLiveQuery(() => db.playlists.get(Number(param.id)));

	const onAddLocalMusics = useCallback(async () => {
		const results = await open({
			multiple: true,
			title: "选择本地音乐",
			filters: [
				{
					name: "音频文件",
					extensions: ["mp3", "flac", "wav", "m4a", "aac", "ogg"],
				},
			],
		});
		if (!results) return;
		const transformed = (
			await Promise.all(
				results.map(async (v) => {
					const normalized = (await path.normalize(v.path)).replace(
						/\\/gi,
						"/",
					);
					try {
						const pathMd5 = md5(normalized);
						const musicInfo = await readLocalMusicMetadata(normalized);

						const coverData = new Uint8Array(musicInfo.cover);
						const coverBlob = new Blob([coverData], { type: "image" });

						return {
							id: pathMd5,
							filePath: normalized,
							songName: musicInfo.name,
							songArtists: musicInfo.artist,
							songAlbum: musicInfo.album,
							lyricFormat: musicInfo.lyric.length > 0 ? "lrc" : "",
							lyric: musicInfo.lyric,
							cover: coverBlob,
							duration: musicInfo.duration,
						} satisfies Song;
					} catch (err) {
						console.warn("解析歌曲元数据以添加歌曲失败", normalized, err);
						return null;
					}
				}),
			)
		).filter((v) => !!v);
		await db.songs.bulkPut(transformed);
		const shouldAddIds = transformed
			.map((v) => v.id)
			.filter((v) => !playlist?.songIds.includes(v))
			.reverse();
		await db.playlists.update(Number(param.id), (obj) => {
			obj.songIds.unshift(...shouldAddIds);
		});
	}, [playlist, param.id]);

	const onPlayList = useCallback(
		async (songIndex = 0, shuffle = false) => {
			if (playlist === undefined) return;
			const collected = await db.songs
				.toCollection()
				.filter((v) => playlist.songIds.includes(v.id))
				.toArray();
			if (shuffle) {
				for (let i = 0; i < collected.length; i++) {
					const j = Math.floor(Math.random() * (i + 1));
					[collected[i], collected[j]] = [collected[j], collected[i]];
				}
			} else {
				collected.sort((a, b) => {
					return (
						playlist.songIds.indexOf(a.id) - playlist.songIds.indexOf(b.id)
					);
				});
			}
			await emitAudioThread("setPlaylist", {
				songs: collected.map((v, i) => ({
					type: "local",
					filePath: v.filePath,
					origOrder: i,
				})),
			});
			await emitAudioThread("jumpToSong", {
				songIndex,
			});
		},
		[playlist],
	);

	const onDeleteSong = useCallback(
		async (songId: string) => {
			if (playlist === undefined) return;
			await db.playlists.update(Number(param.id), (obj) => {
				obj.songIds = obj.songIds.filter((v) => v !== songId);
			});
		},
		[playlist, param.id],
	);

	const onPlaylistDefault = useCallback(onPlayList.bind(null, 0), [onPlayList]);
	const onPlaylistShuffle = useCallback(onPlayList.bind(null, 0, true), [
		onPlayList,
	]);

	return (
		<Container
			mx={{
				initial: "4",
				sm: "9",
			}}
		>
			<Flex direction="column" maxHeight="100vh" height="100vh">
				<Flex gap="4" direction="column" flexGrow="0" pb="4">
					<Flex align="end" pt="4">
						<Button variant="soft" onClick={() => history.back()}>
							<ArrowLeftIcon />
							返回
						</Button>
					</Flex>
					<Flex align="end" gap="4">
						<Avatar size="9" fallback={<div />} />
						<Flex
							direction="column"
							gap="4"
							display={{
								initial: "none",
								sm: "flex",
							}}
						>
							<Heading>{playlist?.name}</Heading>
							<Text>{playlist?.songIds?.length || 0} 首歌曲</Text>
							<Flex gap="2">
								<Button onClick={onPlaylistDefault}>
									<PlayIcon />
									播放全部
								</Button>
								<Button variant="soft" onClick={onPlaylistShuffle}>
									随机播放
								</Button>
								<Button variant="soft" onClick={onAddLocalMusics}>
									<PlusIcon />
									添加本地歌曲
								</Button>
							</Flex>
						</Flex>
						<Flex
							direction="column"
							gap="4"
							display={{
								xs: "flex",
								sm: "none",
							}}
						>
							<Heading>{playlist?.name}</Heading>
							<Text>{playlist?.songIds?.length || 0} 首歌曲</Text>
							<Flex gap="2">
								<IconButton onClick={onPlaylistDefault}>
									<PlayIcon />
								</IconButton>
								<IconButton variant="soft" onClick={onAddLocalMusics}>
									<PlusIcon />
								</IconButton>
							</Flex>
						</Flex>
					</Flex>
				</Flex>
				<Box flexGrow="1" overflow="hidden" minHeight="0">
					{playlist?.songIds && (
						<AutoSizer>
							{({ width, height }) => (
								<FixedSizeList
									itemCount={playlist.songIds.length}
									itemSize={96 + 16}
									innerElementType={PlaylistViewInner}
									width={width}
									height={height}
								>
									{({ index, style }) => (
										<SongCard
											songId={playlist.songIds[index]}
											songIndex={index}
											style={style}
											onPlayList={onPlayList}
											onDeleteSong={onDeleteSong}
										/>
									)}
								</FixedSizeList>
							)}
						</AutoSizer>
					)}
				</Box>
			</Flex>
		</Container>
	);
};