import { create } from "zustand";
import { FILTER_DEFAULTS, type FilterSnapshot, type Tenure } from "../lib/filterUrl";

type JourneyState = FilterSnapshot & {
  shortlist: string[];
  setTenure: (tenure: Tenure) => void;
  setPropertyClass: (propertyClass: string) => void;
  setMonthlyIncome: (monthlyIncome: number) => void;
  setDepositPct: (depositPct: number) => void;
  setMortgageRate: (mortgageRate: number) => void;
  setLoanYears: (loanYears: number) => void;
  setDsrCap: (dsrCap: number) => void;
  setRtiCap: (rtiCap: number) => void;
  setFlatSize: (flatSize: number) => void;
  setSelectedDistrict: (code: string | null) => void;
  /** Click-to-select: clicking the selected district again clears it. */
  selectDistrict: (code: string | null) => void;
  setCompareDistrict: (code: string | null) => void;
  toggleShortlist: (estateId: string) => void;
  clearShortlist: () => void;
  reset: () => void;
};

export const useJourney = create<JourneyState>((set) => ({
  ...FILTER_DEFAULTS,
  shortlist: [],

  setTenure: (tenure) => set({ tenure }),
  setPropertyClass: (propertyClass) => set({ propertyClass }),
  setMonthlyIncome: (monthlyIncome) => set({ monthlyIncome }),
  setDepositPct: (depositPct) => set({ depositPct }),
  setMortgageRate: (mortgageRate) => set({ mortgageRate }),
  setLoanYears: (loanYears) => set({ loanYears }),
  setDsrCap: (dsrCap) => set({ dsrCap }),
  setRtiCap: (rtiCap) => set({ rtiCap }),
  setFlatSize: (flatSize) => set({ flatSize }),
  setSelectedDistrict: (selectedDistrict) => set({ selectedDistrict }),
  selectDistrict: (selectedDistrict) =>
    set((state) => ({
      selectedDistrict: state.selectedDistrict === selectedDistrict ? null : selectedDistrict,
    })),
  setCompareDistrict: (compareDistrict) => set({ compareDistrict }),
  toggleShortlist: (estateId) =>
    set((state) => ({
      shortlist: state.shortlist.includes(estateId)
        ? state.shortlist.filter((id) => id !== estateId)
        : [...state.shortlist, estateId],
    })),
  clearShortlist: () => set({ shortlist: [] }),
  reset: () => set({ ...FILTER_DEFAULTS, shortlist: [] }),
}));
