'use client';

import { cn } from 'cn';
import { useLayoutEffect, useRef } from 'react';

/**
 * พื้นหลังของตัวเลือกที่เลือกอยู่ เลื่อนไปหาตัวที่เลือกใหม่แทนการกระโดด
 * วางเป็นลูกตัวแรกของกลุ่มปุ่ม กลุ่มต้องมี class `relative group/seg`
 * ปุ่มต้องมี `relative z-10` และซ่อนพื้นหลังตอนเลือกด้วย `group-data-[seg=ready]/seg:bg-transparent`
 * ก่อนสคริปต์โหลดเสร็จ ปุ่มที่เลือกยังแสดงพื้นหลังของตัวเอง จึงไม่มีจังหวะที่ไม่เห็นว่าเลือกอะไรอยู่
 */
export function SegmentIndicator({
  selector,
  className,
}: {
  /** ตัวเลือก CSS ของปุ่มที่เลือกอยู่ เช่น `[aria-checked=true]` */
  selector: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const pill = ref.current;
    const group = pill?.parentElement;
    if (!pill || !group) return;
    let placed = false;

    const place = () => {
      const active = group.querySelector<HTMLElement>(selector);
      if (!active) {
        pill.style.opacity = '0';
        return;
      }
      pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.height = `${active.offsetHeight}px`;
      pill.style.opacity = '1';
      if (!placed) {
        placed = true;
        group.dataset.seg = 'ready';
        // วางตำแหน่งแรกโดยไม่เลื่อน แล้วค่อยเปิดการเลื่อนในเฟรมถัดไป
        requestAnimationFrame(() => pill.setAttribute('data-animate', ''));
      }
    };

    place();
    const mutations = new MutationObserver(place);
    mutations.observe(group, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-checked', 'aria-pressed', 'aria-selected', 'data-state'],
    });
    const resize = new ResizeObserver(place);
    resize.observe(group);
    return () => {
      mutations.disconnect();
      resize.disconnect();
      delete group.dataset.seg;
    };
  }, [selector]);

  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute top-0 left-0 rounded-md opacity-0',
        'data-animate:transition-[transform,width,height,background-color] data-animate:duration-300 data-animate:ease-[cubic-bezier(0.3,1.25,0.5,1)]',
        className,
      )}
    />
  );
}
