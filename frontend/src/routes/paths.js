// Every URL of the app in one place. Use PATHS.x in links and navigate(), never a typed string.
export const PATHS = {
  root: '/',

  // public
  login: '/login',
  register: '/register',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',

  // private
  dashboard: '/dashboard',
  expenses: '/expenses',
  expenseDetails: '/expenses/:id',
  income: '/income',
  accounts: '/accounts',
  categories: '/categories',
  budgets: '/budgets',
  recurring: '/recurring',
  reports: '/reports',
  notifications: '/notifications',
  settings: '/settings',

  // errors
  serverError: '/error',
};

export const expensePath = (id) => `/expenses/${id}`;
