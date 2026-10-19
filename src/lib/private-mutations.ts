import { mutationSchema } from "./validation";
import type { PersonalData } from "./private-types";
export function applyPrivateMutation(
  current: PersonalData,
  type: string,
  value: object,
): PersonalData {
  const parsed = mutationSchema.parse({ type, data: value }),
    next = { ...current };
  switch (parsed.type) {
    case "weight":
      next.weights = [
        ...current.weights.filter((x) => x.date !== parsed.data.date),
        { ...parsed.data, id: crypto.randomUUID() },
      ];
      break;
    case "document":
      next.documents = [
        { ...parsed.data, id: crypto.randomUUID() },
        ...current.documents,
      ];
      break;
    case "menu":
      next.plans = [
        { ...parsed.data, id: crypto.randomUUID() },
        ...current.plans,
      ];
      break;
    case "preferences":
      next.preferences = parsed.data;
      break;
    case "slot":
      next.slots = current.slots.filter(
        (x) => x.date !== parsed.data.date || x.slot !== parsed.data.slot,
      );
      if (parsed.data.recipeId)
        next.slots.push({ ...parsed.data, recipeId: parsed.data.recipeId });
      break;
    case "groceryCheck":
      next.groceryChecks = [
        ...current.groceryChecks.filter(
          (x) =>
            x.week !== parsed.data.week ||
            x.ingredientId !== parsed.data.ingredientId,
        ),
        parsed.data,
      ];
      break;
    case "pantry":
      next.pantry = [
        ...current.pantry.filter((x) => x.id !== parsed.data.id),
        parsed.data,
      ];
      break;
    case "pantryDelete":
      next.pantry = current.pantry.filter((x) => x.id !== parsed.data.id);
      break;
    case "journal": {
      const previous = current.journal.find((x) => x.date === parsed.data.date);
      if ((previous?.revision || 0) !== parsed.data.expectedRevision)
        throw new Error("conflict");
      const { expectedRevision, ...entry } = parsed.data;
      next.journal = [
        {
          ...entry,
          id: previous?.id || crypto.randomUUID(),
          revision: expectedRevision + 1,
        },
        ...current.journal.filter((x) => x.date !== entry.date),
      ];
      break;
    }
  }
  return next;
}
