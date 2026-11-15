import "server-only";
import { cache } from "react";
import { loadDashboardData } from "./load";

export const getDashboardData = cache(loadDashboardData);
