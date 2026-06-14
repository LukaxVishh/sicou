type ComingSoonPageProps = {
  title: string;
  description: string;
};

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">Em construção</p>

      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {title}
      </h1>

      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        {description}
      </p>
    </div>
  );
}