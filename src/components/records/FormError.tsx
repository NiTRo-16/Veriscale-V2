export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-soft px-3 py-2 text-[12.5px] text-red">
      {error}
    </p>
  );
}
