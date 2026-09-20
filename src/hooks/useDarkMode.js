import { useState, useEffect } from "react";

export default function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("engmaster-theme");
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("engmaster-theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
}
