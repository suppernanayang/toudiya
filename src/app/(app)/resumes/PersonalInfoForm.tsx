"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updatePersonalInfo } from "./actions";

export function PersonalInfoForm({
  initialName,
  initialEmail,
  initialPhone,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const result = await updatePersonalInfo(formData);
    if (!result.ok) setError(result.message);
    else setSaved(true);
  }

  return (
    <form action={handleSubmit} className="p-4 grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input
          name="name"
          type="text"
          defaultValue={initialName}
          placeholder="姓名（必填，PDF 抬头会用到）"
          className="h-9 border border-line rounded-lg px-2.5 bg-white"
          required
        />
        <input
          name="email"
          type="email"
          defaultValue={initialEmail}
          placeholder="邮箱"
          className="h-9 border border-line rounded-lg px-2.5 bg-white"
        />
        <input
          name="phone"
          type="text"
          defaultValue={initialPhone}
          placeholder="手机号"
          className="h-9 border border-line rounded-lg px-2.5 bg-white"
        />
      </div>
      {error ? <p className="m-0 text-rose text-xs">{error}</p> : null}
      {saved ? <p className="m-0 text-green text-xs">已保存</p> : null}
      <div>
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-9 rounded-lg inline-flex items-center px-3 text-sm border border-line disabled:opacity-60"
    >
      {pending ? "保存中…" : "保存个人信息"}
    </button>
  );
}
