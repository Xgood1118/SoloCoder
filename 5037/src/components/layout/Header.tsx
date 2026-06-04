import { Link } from "react-router-dom";
import { Search, User, PlusCircle } from "lucide-react";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-cream shadow-sm z-50 flex items-center justify-between px-4">
      <Link to="/" className="font-serif text-xl font-bold text-brand-500">
        味知坊
      </Link>
      <div className="flex items-center gap-4">
        <Link to="/search" className="text-warm-brown hover:text-brand-500 transition-colors">
          <Search size={22} />
        </Link>
        <Link to="/profile" className="text-warm-brown hover:text-brand-500 transition-colors">
          <User size={22} />
        </Link>
        <Link to="/publish" className="text-warm-brown hover:text-brand-500 transition-colors">
          <PlusCircle size={22} />
        </Link>
      </div>
    </header>
  );
}
