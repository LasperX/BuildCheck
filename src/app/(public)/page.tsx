import { CircleCheck, CircleX, Info, Recycle, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

// หน้าชั่วคราวของเฟส 1: ใช้ตรวจว่า Token ฟอนต์ และคอมโพเนนต์ทำงานครบ หน้าแรกจริงจะมาแทนภายหลัง
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1328px] flex-1 px-4 py-8 md:px-6 md:py-12">
      <h1 className="t-display">BuildCheck</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        ตั้งโปรเจคเฟส 1 เรียบร้อย หน้านี้เป็นหน้าชั่วคราวสำหรับเช็กฟอนต์ไทย สี และคอมโพเนนต์
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ปุ่ม</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button size="lg">ใหญ่ 48</Button>
            <Button>ปุ่มหลัก</Button>
            <Button variant="secondary">ปุ่มรอง</Button>
            <Button variant="ghost">ปุ่มโปร่ง</Button>
            <Button variant="destructive">อันตราย</Button>
            <Button size="sm">เล็ก 32</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>สถานะ (มีไอคอนเสมอ)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge variant="err">
              <CircleX />
              ผิดพลาด
            </Badge>
            <Badge variant="warn">
              <TriangleAlert />
              เตือน
            </Badge>
            <Badge variant="ok">
              <CircleCheck />
              ผ่าน
            </Badge>
            <Badge variant="info">
              <Info />
              ข้อมูล
            </Badge>
            <Badge variant="used">
              <Recycle />
              มือสอง เกรด B
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ฟอร์ม</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input aria-label="ช่องค้นหาตัวอย่าง" placeholder="ค้นหาชื่อรุ่นหรือยี่ห้อ" />
            <label className="flex items-center gap-2 text-sm">
              <Switch defaultChecked />
              กรองอัจฉริยะ
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ตัวเลขและชื่อเทคนิค</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">฿29,200</p>
            <p className="font-mono text-xs text-muted-foreground">R01 · AM5 · DDR5 · 372 W</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
