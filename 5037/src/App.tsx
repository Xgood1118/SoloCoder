import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import RecipeDetail from "@/pages/RecipeDetail";
import Publish from "@/pages/Publish";
import Search from "@/pages/Search";
import ShoppingList from "@/pages/ShoppingList";
import Profile from "@/pages/Profile";
import UserProfile from "@/pages/UserProfile";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/recipe/:id" element={<RecipeDetail />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/search" element={<Search />} />
          <Route path="/shopping-list" element={<ShoppingList />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user/:id" element={<UserProfile />} />
        </Route>
      </Routes>
    </Router>
  );
}
