import { createBrowserRouter } from "react-router-dom";
import { AMLLDevPage } from "./pages/amll-dev";
import { MGEditPage } from "./pages/amll-dev/mg-edit";
import { MainPage } from "./pages/main";
import { PlaylistPage } from "./pages/playlist";
import { SettingsPage } from "./pages/settings";
import { SongPage } from "./pages/song";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <MainPage />,
	},
	{
		path: "/settings",
		element: <SettingsPage />,
	},
	{
		path: "/playlist/:id",
		element: <PlaylistPage />,
	},
	{
		path: "/song/:id",
		element: <SongPage />,
	},
	{
		path: "/amll-dev/mg-edit",
		element: <MGEditPage />,
	},
	{
		path: "/amll-dev",
		element: <AMLLDevPage />,
	},
]);
