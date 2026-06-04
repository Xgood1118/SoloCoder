import { Link, useLocation } from "react-router-dom";
import { ChefHat, Search, PlusCircle, ShoppingCart, User } from "lucide-react";

const tabs = [
  { path: "/", label: "首页", icon: ChefHat },
  { path: "/search", label: "搜索", icon: Search },
  { path: "/publish", label: "发布", icon: PlusCircle },
  { path: "/shopping-list", label: "购物清单", icon: ShoppingCart },
  { path: "/profile", label: "我的", icon: User },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-cream border-t border-warm-gray z-50">
      <div className="flex items-center justify-around h-full">
        {tabs.map(({ path, label, icon: Icon }) => {
          const isActive = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center gap-0.5 w-full h-full relative"
            >
              <Icon
                size={22}
                className={isActive ? "text-brand-500" : "text-warm-muted"}
              />
              <span
                className={`text-xs ${isActive ? "text-brand-500 font-medium" : "text-warm-muted"}`}
              >
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-brand-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
