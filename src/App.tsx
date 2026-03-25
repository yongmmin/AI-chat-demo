import { BrowserRouter } from "react-router";
import { Routes } from "./pages/Routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes />
    </BrowserRouter>
  );
}
