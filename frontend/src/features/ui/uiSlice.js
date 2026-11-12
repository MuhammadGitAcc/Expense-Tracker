import { createSlice } from '@reduxjs/toolkit';

// Layout state only: the desktop sidebar (collapsed or not) and the phone slide-over menu.
const initialState = {
  sidebarCollapsed: false,
  mobileMenuOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    openMobileMenu(state) {
      state.mobileMenuOpen = true;
    },
    closeMobileMenu(state) {
      state.mobileMenuOpen = false;
    },
  },
});

export const { toggleSidebar, openMobileMenu, closeMobileMenu } = uiSlice.actions;

export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;
export const selectMobileMenuOpen = (state) => state.ui.mobileMenuOpen;

export default uiSlice.reducer;
