import { expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import {
  boot,
  nav,
  fireEvent,
  screen,
  within,
  freshState,
  plan,
  readState,
} from "./uxSupport";
import { recordPurchase } from "../src/helpers/inventory";

it("creates a receipt, links a price without buying stock again, and searches accented shop names", async () => {
  const initial = recordPurchase(
    freshState(structuredClone(plan)),
    plan.meals[0].ingredients[0],
    500,
    "fridge",
  );
  await boot(initial);
  nav("Shopping");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Purchase history & receipts",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add receipt" }));
  fireEvent.change(screen.getByLabelText("Shop / place of purchase"), {
    target: { value: "ĐÀ NẴNG Market" },
  });
  fireEvent.change(screen.getByLabelText("Receipt total (optional)"), {
    target: { value: "125000" },
  });
  fireEvent.change(
    screen.getByLabelText("Notes / purchased items to help you search later"),
    { target: { value: "Family food receipt" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save receipt" }));
  await waitFor(() => expect(readState().shoppingInvoices).toHaveLength(1));
  const invoice = readState().shoppingInvoices![0];
  expect(invoice.total).toEqual({ amount: 125000, currency: "VND" });
  fireEvent.click(screen.getByRole("button", { name: "Record / edit price" }));
  fireEvent.change(screen.getByLabelText("Total paid for this quantity"), {
    target: { value: "45000" },
  });
  fireEvent.change(screen.getByLabelText("Link receipt"), {
    target: { value: invoice.id },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save purchase price" }));
  await screen.findByText("Purchase price saved.");
  expect(readState().purchased).toEqual(initial.purchased);
  expect(readState().purchaseReceipts?.[0]).toMatchObject({
    paid: { amount: 45000, currency: "VND" },
    invoiceId: invoice.id,
  });
  fireEvent.change(screen.getByLabelText("Search items, shops or notes"), {
    target: { value: "da nang" },
  });
  expect(screen.getByRole("heading", { name: "ĐÀ NẴNG Market" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search items, shops or notes"), {
    target: { value: "a shop that does not exist" },
  });
  expect(screen.queryByRole("heading", { name: "ĐÀ NẴNG Market" })).toBeNull();
  expect(screen.getByText("No matching receipts.")).toBeTruthy();
});
it("keeps camera and library controls distinct and preserves an unfinished receipt after invalid input", async () => {
  await boot();
  nav("Shopping");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Purchase history & receipts",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add receipt" }));
  const camera = screen.getByLabelText(
    "Capture receipt with camera",
  ) as HTMLInputElement;
  const library = screen.getByLabelText(
    "Select receipt photos from library",
  ) as HTMLInputElement;
  expect(camera.getAttribute("capture")).toBe("environment");
  expect(camera.accept).toBe("image/*");
  expect(library.hasAttribute("capture")).toBe(false);
  expect(library.multiple).toBe(true);
  fireEvent.change(screen.getByLabelText("Shop / place of purchase"), {
    target: { value: "My shop" },
  });
  fireEvent.change(screen.getByLabelText("Receipt total (optional)"), {
    target: { value: "-1" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Save receipt",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(readState().shoppingInvoices).toBeUndefined();
  expect(
    (screen.getByLabelText("Shop / place of purchase") as HTMLInputElement)
      .value,
  ).toBe("My shop");
});
