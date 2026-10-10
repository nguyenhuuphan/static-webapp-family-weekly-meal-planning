import { useDispatch, useSelector, useStore } from "react-redux";
import type { IRootState, AppDispatch, PlannerStore } from "./store";
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<IRootState>();
export const useAppStore = useStore.withTypes<PlannerStore>();
