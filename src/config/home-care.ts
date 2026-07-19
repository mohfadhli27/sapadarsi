import { Activity, Radar, type LucideIcon } from "lucide-react";

export type HomeCareApp = {
  id: string;
  name: string;
  icon: LucideIcon;
  iconBg: string;
};

/** Aplikasi Home Care — grid kompak ala super-app. */
export const HOME_CARE_APPS: HomeCareApp[] = [
  {
    id: "strap-r",
    name: "Strap-R",
    icon: Activity,
    iconBg: "bg-rose-500 text-white",
  },
  {
    id: "spyder",
    name: "Spyder",
    icon: Radar,
    iconBg: "bg-sky-500 text-white",
  },
];
