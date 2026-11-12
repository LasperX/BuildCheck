'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AdminBadge, type UserRole } from '@/components/account/admin-badge';
import { UserAvatar } from '@/components/account/user-avatar';
import { FormAlert, FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authClient, authErrorMessage } from '@/lib/auth-client';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type ProfileInput,
  profileSchema,
} from '@/lib/validators/auth';
import { updateAvatar, updateProfile } from '@/server/actions/account';

type Feedback = { variant: 'ok' | 'err'; text: string } | null;

function Result({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <FormAlert
      variant={feedback.variant}
      icon={feedback.variant === 'ok' ? <CircleCheck /> : <CircleX />}
    >
      {feedback.text}
    </FormAlert>
  );
}

type SettingsUser = {
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  role: UserRole;
  bio: string;
  image: string | null;
};

export function SettingsPanels({
  user,
  hasPassword,
  verificationRequired,
}: {
  user: SettingsUser;
  hasPassword: boolean;
  /** เว็บจริงที่ยังไม่ได้ตั้งระบบส่งอีเมล ไม่บังคับยืนยันอีเมล (lib/email-verification) */
  verificationRequired: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Suspense>
        <WelcomeNotice verificationRequired={verificationRequired} />
      </Suspense>
      {user.role === 'admin' ? <AdminStatusPanel /> : null}
      <EmailPanel
        email={user.email}
        verified={user.emailVerified}
        verificationRequired={verificationRequired}
      />
      <ProfilePanel user={user} />
      {hasPassword ? <PasswordPanel /> : null}
      <SessionsPanel />
      <DeletePanel hasPassword={hasPassword} />
    </div>
  );
}

function WelcomeNotice({ verificationRequired }: { verificationRequired: boolean }) {
  const params = useSearchParams();
  if (params.get('verified')) {
    return (
      <FormAlert variant="ok" icon={<CircleCheck />}>
        ยืนยันอีเมลเรียบร้อยแล้ว ใช้ฟีเจอร์ชุมชนได้เลย
      </FormAlert>
    );
  }
  if (params.get('welcome')) {
    return (
      <FormAlert variant="info" icon={<Info />}>
        {verificationRequired
          ? 'สมัครสมาชิกเรียบร้อย เราส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว'
          : 'สมัครสมาชิกเรียบร้อย ใช้งานได้ทุกฟีเจอร์แล้ว ทั้งบันทึก แชร์ โหวต และคอมเมนต์'}
      </FormAlert>
    );
  }
  return null;
}

function EmailPanel({
  email,
  verified,
  verificationRequired,
}: {
  email: string;
  verified: boolean;
  verificationRequired: boolean;
}) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL: '/me/settings?verified=1',
    });
    setFeedback(
      result.error
        ? { variant: 'err', text: authErrorMessage(result.error) }
        : { variant: 'ok', text: 'ส่งลิงก์ยืนยันแล้ว กรุณาเช็กอีเมลของคุณ' },
    );
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>อีเมล</CardTitle>
        <CardDescription>อีเมลไม่แสดงบนหน้าสาธารณะ</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm break-all">{email}</p>
        {verified ? (
          <FormAlert variant="ok" icon={<CircleCheck />}>
            ยืนยันอีเมลแล้ว
          </FormAlert>
        ) : !verificationRequired ? (
          <FormAlert variant="info" icon={<Info />}>
            ตอนนี้ไม่ต้องยืนยันอีเมล ใช้ฟีเจอร์ชุมชนได้ทุกอย่าง ทั้งโหวต คอมเมนต์ Fork และรายงานราคา
          </FormAlert>
        ) : (
          <>
            <FormAlert variant="warn" icon={<TriangleAlert />}>
              ยังไม่ได้ยืนยันอีเมล จึงยังโหวต คอมเมนต์ และ Fork สเปกไม่ได้
            </FormAlert>
            <div>
              <Button variant="secondary" size="sm" disabled={pending} onClick={resend}>
                {pending ? 'กำลังส่ง...' : 'ส่งลิงก์ยืนยันอีกครั้ง'}
              </Button>
            </div>
          </>
        )}
        <Result feedback={feedback} />
      </CardContent>
    </Card>
  );
}

function ProfilePanel({ user }: { user: SettingsUser }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [uploading, setUploading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: user.displayName, bio: user.bio },
  });

  async function onPickAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const data = new FormData();
    data.set('file', file);
    const result = await updateAvatar(data);
    setFeedback(
      result.ok
        ? { variant: 'ok', text: 'เปลี่ยนรูปโปรไฟล์แล้ว' }
        : { variant: 'err', text: result.error },
    );
    setUploading(false);
    event.target.value = '';
    if (result.ok) router.refresh();
  }

  async function onSubmit(values: ProfileInput) {
    const result = await updateProfile(values);
    setFeedback(
      result.ok
        ? { variant: 'ok', text: 'บันทึกโปรไฟล์แล้ว' }
        : { variant: 'err', text: result.error },
    );
    if (result.ok) router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>โปรไฟล์</CardTitle>
        <CardDescription>ข้อมูลนี้แสดงบนหน้าโปรไฟล์สาธารณะ</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="post"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className="flex items-center gap-3">
            <UserAvatar name={user.displayName} image={user.image} size={56} />
            <div className="min-w-0 text-sm">
              <p className="flex items-center gap-1.5 font-semibold">
                <span className="truncate">{user.displayName}</span>
                <AdminBadge role={user.role} />
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">@{user.username}</p>
              <label className="mt-1 inline-flex h-8 cursor-pointer items-center rounded-sm border border-input bg-surface px-3 text-xs font-medium focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:bg-surface-2">
                {uploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูป'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={onPickAvatar}
                />
              </label>
              <p className="mt-1 text-xs text-subtle">JPG, PNG หรือ WebP ไม่เกิน 2 MB</p>
            </div>
          </div>
          <FormField id="displayName" label="ชื่อที่แสดง" error={errors.displayName?.message}>
            <Input
              id="displayName"
              aria-invalid={Boolean(errors.displayName)}
              {...register('displayName')}
            />
          </FormField>
          <FormField
            id="bio"
            label="คำแนะนำตัว"
            error={errors.bio?.message}
            hint="ไม่เกิน 300 ตัวอักษร"
          >
            <textarea
              id="bio"
              rows={3}
              aria-invalid={Boolean(errors.bio)}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-base outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring aria-invalid:border-destructive md:text-sm"
              {...register('bio')}
            />
          </FormField>
          <Result feedback={feedback} />
          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordPanel() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordInput) {
    const result = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    });
    if (result.error) {
      setFeedback({ variant: 'err', text: authErrorMessage(result.error) });
      return;
    }
    reset();
    setFeedback({ variant: 'ok', text: 'เปลี่ยนรหัสผ่านแล้ว และออกจากระบบอุปกรณ์อื่นเรียบร้อย' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>เปลี่ยนรหัสผ่าน</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          method="post"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <FormField
            id="currentPassword"
            label="รหัสผ่านปัจจุบัน"
            error={errors.currentPassword?.message}
          >
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.currentPassword)}
              {...register('currentPassword')}
            />
          </FormField>
          <FormField
            id="newPassword"
            label="รหัสผ่านใหม่"
            error={errors.newPassword?.message}
            hint="อย่างน้อย 8 ตัวอักษร"
          >
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.newPassword)}
              {...register('newPassword')}
            />
          </FormField>
          <FormField
            id="confirmPassword"
            label="ยืนยันรหัสผ่านใหม่"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </FormField>
          <Result feedback={feedback} />
          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionsPanel() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, setPending] = useState(false);

  async function signOutEverywhere() {
    setPending(true);
    const result = await authClient.revokeSessions();
    if (result.error) {
      setFeedback({ variant: 'err', text: authErrorMessage(result.error) });
      setPending(false);
      return;
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>อุปกรณ์ที่เข้าสู่ระบบ</CardTitle>
        <CardDescription>ออกจากระบบทุกเครื่อง รวมถึงเครื่องนี้</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Result feedback={feedback} />
        <div>
          <Button variant="secondary" disabled={pending} onClick={signOutEverywhere}>
            {pending ? 'กำลังออกจากระบบ...' : 'ออกจากระบบทุกอุปกรณ์'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DeletePanel({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const result = await authClient.deleteUser(hasPassword ? { password } : {});
    if (result.error) {
      setFeedback({ variant: 'err', text: authErrorMessage(result.error) });
      setPending(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ลบบัญชี</CardTitle>
        <CardDescription>
          ลบบัญชี สเปก คอมเมนต์ โหวต และรายการโปรดของคุณถาวร กู้คืนไม่ได้
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Result feedback={feedback} />
        {confirming ? (
          <>
            {hasPassword ? (
              <FormField id="deletePassword" label="กรอกรหัสผ่านเพื่อยืนยัน">
                <Input
                  id="deletePassword"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={pending || (hasPassword && !password)}
                onClick={remove}
              >
                {pending ? 'กำลังลบ...' : 'ยืนยันลบบัญชีถาวร'}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                ยกเลิก
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              ลบบัญชีของฉัน
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** บอกแอดมินว่าบัญชีนี้มีป้ายติ๊กถูก และป้ายแสดงที่ไหนบ้าง */
function AdminStatusPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AdminBadge role="admin" size={20} />
          บัญชีแอดมิน BuildCheck
        </CardTitle>
        <CardDescription>
          ป้ายติ๊กถูกสีฟ้าแสดงข้างชื่อของคุณในหน้าโปรไฟล์ การ์ดสเปก หน้าสเปก และคอมเมนต์
          ให้ผู้ใช้รู้ว่าเนื้อหานี้มาจากทีมดูแลเว็บ ป้ายนี้ได้จากสิทธิ์แอดมินเท่านั้น
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/admin" className="text-sm font-medium text-link hover:underline">
          ไปหน้าหลังบ้าน
        </Link>
      </CardContent>
    </Card>
  );
}
