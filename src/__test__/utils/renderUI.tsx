import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Routes } from "../../pages/Routes";

/**
 * 앱 라우트가 연결된 상태로 UI를 렌더링합니다.
 * initialEntries로 초기 경로를 지정할 수 있습니다.
 */
export function renderUI(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes />
    </MemoryRouter>,
  );
}
