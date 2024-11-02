import { PlayIcon } from "@radix-ui/react-icons";
import { Avatar, Box, Flex, type FlexProps, Inset } from "@radix-ui/themes";
import classNames from "classnames";
import { useLiveQuery } from "dexie-react-hooks";
import { useAtomValue } from "jotai";
import md5 from "md5";
import {
	type FC,
	type HTMLProps,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Trans } from "react-i18next";
import { ViewportList, type ViewportListRef } from "react-viewport-list";
import { type Song, db } from "../../dexie.ts";
import {
	currentPlaylistAtom,
	currentPlaylistMusicIndexAtom,
} from "../../states/index.ts";
import { type SongData, emitAudioThread } from "../../utils/player.ts";
import styles from "./index.module.css";

// TODO: 会产生闪烁更新，需要检查修正
const PlaylistSongItem: FC<
	{
		songData: SongData;
		index: number;
	} & HTMLProps<HTMLDivElement>
> = ({ songData, className, index, ...props }) => {
	const playlistIndex = useAtomValue(currentPlaylistMusicIndexAtom);
	const [songId, setSongId] = useState<string>("");
	const lastSongId = useRef("");

	useLayoutEffect(() => {
		if (songData.type === "local") {
			const newSongId = md5(songData.filePath);
			if (lastSongId.current !== newSongId) {
				console.log("newSongId", lastSongId.current, "->", newSongId);
				setSongId(newSongId);
			}
			lastSongId.current = newSongId;
		}
	}, [songData]);

	const [curSongInfo, setCurSongInfo] = useState<Song>();
	const songInfo = useLiveQuery(() => db.songs.get(songId), [songId]);

	useLayoutEffect(() => {
		if (songInfo) setCurSongInfo(songInfo);
	}, [songInfo]);

	const name = useMemo(() => {
		if (curSongInfo?.songName) return curSongInfo?.songName;
		if (songData.type === "local") return songData.filePath;
		return "";
	}, [songData, curSongInfo]);

	const artists = useMemo(() => {
		if (curSongInfo) return curSongInfo?.songArtists ?? "";
		return "";
	}, [curSongInfo]);

	const [cover, setCover] = useState("");

	useLayoutEffect(() => {
		if (curSongInfo?.cover) {
			const newUri = URL.createObjectURL(curSongInfo.cover);
			setCover(newUri);
			return () => {
				URL.revokeObjectURL(newUri);
			};
		}
	}, [curSongInfo]);

	return (
		<div
			className={classNames(className, styles.playlistSongItem)}
			onDoubleClick={() => {
				emitAudioThread("jumpToSong", {
					songIndex: index,
				});
			}}
			{...props}
		>
			<Avatar size="4" fallback={<div />} src={cover} />
			<div className={styles.musicInfo}>
				<div className={styles.name}>{name}</div>
				<div className={styles.artists}>{artists}</div>
			</div>
			{playlistIndex === index && <PlayIcon />}
		</div>
	);
};

export const NowPlaylistCard: FC<FlexProps> = (props) => {
	const playlist = useAtomValue(currentPlaylistAtom);
	const playlistIndex = useAtomValue(currentPlaylistMusicIndexAtom);
	const playlistRef = useRef<ViewportListRef>();
	const playlistContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (playlistRef.current) {
			playlistRef.current.scrollToIndex({
				index: playlistIndex,
			});
		}
	}, [playlistIndex]);

	return (
		<Flex
			direction="column"
			maxWidth="400px"
			maxHeight="500px"
			style={{
				height: "50vh",
				width: "max(10vw, 50vh)",
				backdropFilter: "blur(1em)",
				backgroundColor: "var(--black-a8)",
			}}
			{...props}
		>
			<Box py="3" px="4">
				<Trans i18nKey="playbar.playlist.title">当前播放列表</Trans>
			</Box>
			<Inset
				clip="padding-box"
				side="bottom"
				pb="current"
				style={{ overflowY: "auto" }}
				ref={playlistContainerRef}
			>
				<ViewportList
					items={playlist}
					ref={playlistRef}
					viewportRef={playlistContainerRef}
				>
					{(songData, index) => (
						<PlaylistSongItem
							key={`playlist-song-item-${index}`}
							songData={songData}
							index={index}
						/>
					)}
				</ViewportList>
			</Inset>
		</Flex>
	);
};