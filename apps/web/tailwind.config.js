/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        domain: {
          study: "#6366f1",
          business: "#f59e0b",
          social: "#ec4899",
          relax: "#10b981",
        },
      },
    },
  },
  plugins: [],
};
