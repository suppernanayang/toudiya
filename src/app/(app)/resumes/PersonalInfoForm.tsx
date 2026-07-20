"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { removeAvatar, updatePersonalInfo } from "./actions";

export function PersonalInfoForm({
  initialName,
  initialEmail,
  initialPhone,
  avatarUrl,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  avatarUrl: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const result = await updatePersonalInfo(formData);
    if (!result.ok) setError(result.message);
    else setSaved(true);
  }

  function handleRemoveAvatar() {
    setError(null);
    setSaved(false);
    removeAvatar().then((result) => {
      if (!result.ok) setError(result.message);
      else setSaved(true);
    });
  }

  const displayAvatar = preview || avatarUrl;

  return (
    <form action={handleSubmit} className="p-4 grid gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-[repeat(3,1fr)_auto] gap-2.5 items-start">
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

        <div className="row-span-2 flex flex-col items-center gap-1.5">
          <div className="w-[70px] h-[98px] border border-dashed border-line rounded-md overflow-hidden bg-[#fbfdfc] flex items-center justify-center">
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayAvatar} alt="证件照预览" className="w-full h-full object-cover" />
            ) : (
              <span className="text-soft text-[10px] text-center px-1">证件照<br />1寸</span>
            )}
          </div>
          {avatarUrl && !preview ? (
            <button type="button" onClick={handleRemoveAvatar} className="text-rose text-xs">
              移除照片
            </button>
          ) : null}
        </div>

        <div className="sm:col-span-3 grid gap-1">
          <input
            name="avatar"
            type="file"
            accept=".jpg,.jpeg,.png"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) {
                setPreview(null);
                return;
              }
              setPreview(URL.createObjectURL(file));
            }}
          />
          <span className="text-muted text-xs">
            建议上传 1 寸证件照（2.5cm × 3.5cm，或近似比例），JPG / PNG 格式；不上传的话简历不显示照片。
          </span>
        </div>
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
