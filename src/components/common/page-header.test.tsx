import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "@/components/common/page-header";

describe("PageHeader", () => {
  it("renders the title and description", () => {
    render(<PageHeader title="Assessments" description="Manage your assessments" />);

    expect(screen.getByRole("heading", { name: "Assessments" })).toBeInTheDocument();
    expect(screen.getByText("Manage your assessments")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(<PageHeader title="Assessments" actions={<button>New</button>} />);

    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});
