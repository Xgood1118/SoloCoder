import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import NowPlaying from "@/pages/NowPlaying";
import Library from "@/pages/Library";
import Playlists from "@/pages/Playlists";
import PlaylistDetail from "@/pages/PlaylistDetail";
import Search from "@/pages/Search";
import Settings from "@/pages/Settings";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

function AppContent() {
  useAudioPlayer();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/now-playing" element={<NowPlaying />} />
        <Route path="/library" element={<Library />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlists/:id" element={<PlaylistDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
