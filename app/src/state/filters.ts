import { create } from "zustand";

export type Tenure = "sale" | "rent";

type FilterState = {
  tenure: Tenure;
  selectedDistrict: string | null;
  compareDistrict: string | null;
  propertyClass: string;
  setTenure: (tenure: Tenure) => void;
  selectDistrict: (code: string | null) => void;
  setCompareDistrict: (code: string | null) => void;
  setPropertyClass: (propertyClass: string) => void;
  reset: () => void;
};

export const useFilters = create<FilterState>((set) => ({
  tenure: "sale",
  selectedDistrict: null,
  compareDistrict: null,
  propertyClass: "ALL",
  setTenure: (tenure) => set({ tenure }),
  selectDistrict: (selectedDistrict) =>
    set((state) => ({
      selectedDistrict: state.selectedDistrict === selectedDistrict ? null : selectedDistrict,
    })),
  setCompareDistrict: (compareDistrict) => set({ compareDistrict }),
  setPropertyClass: (propertyClass) => set({ propertyClass }),
  reset: () =>
    set({
      tenure: "sale",
      selectedDistrict: null,
      compareDistrict: null,
      propertyClass: "ALL",
    }),
}));
