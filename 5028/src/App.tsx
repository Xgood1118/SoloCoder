import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
import AttractionDetail from "@/pages/AttractionDetail";
import Favorites from "@/pages/Favorites";
import TripNew from "@/pages/TripNew";
import TripPlanner from "@/pages/TripPlanner";
import TripShare from "@/pages/TripShare";
import SharedTrip from "@/pages/SharedTrip";
import Profile from "@/pages/Profile";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-sand-50">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/attraction/:id" element={<AttractionDetail />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/trip/new" element={<TripNew />} />
          <Route path="/trip/:id" element={<TripPlanner />} />
          <Route path="/trip/:id/share" element={<TripShare />} />
          <Route path="/share/:shareId" element={<SharedTrip />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </Router>
  );
}
