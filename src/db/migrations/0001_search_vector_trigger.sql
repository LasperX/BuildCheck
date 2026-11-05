-- เติม parts.search_vector อัตโนมัติจาก "ยี่ห้อ + ชื่อรุ่น" เพื่อให้ค้นหาได้ทั้งสองอย่าง (หัวข้อ 3.2)
-- ทำใน Trigger เพราะยี่ห้ออยู่คนละตาราง และจะได้ครอบคลุมทุกทาง ทั้งฟอร์มหลังบ้านและนำเข้า CSV
-- ใช้ค่า 'simple' เพราะ PostgreSQL ไม่มีตัวตัดคำภาษาไทย และชื่อรุ่นส่วนใหญ่เป็นภาษาอังกฤษ

CREATE FUNCTION parts_search_vector_refresh() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'simple',
    coalesce((SELECT name FROM brands WHERE id = NEW.brand_id), '') || ' ' || NEW.model
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER parts_search_vector_trigger
  BEFORE INSERT OR UPDATE OF model, brand_id ON parts
  FOR EACH ROW EXECUTE FUNCTION parts_search_vector_refresh();
--> statement-breakpoint
-- เมื่อแอดมินแก้ชื่อยี่ห้อ ให้คำนวณใหม่ให้อะไหล่ทุกชิ้นของยี่ห้อนั้น
CREATE FUNCTION brands_refresh_parts_search_vector() RETURNS trigger AS $$
BEGIN
  UPDATE parts
    SET search_vector = to_tsvector('simple', NEW.name || ' ' || model)
    WHERE brand_id = NEW.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER brands_refresh_parts_search_vector_trigger
  AFTER UPDATE OF name ON brands
  FOR EACH ROW EXECUTE FUNCTION brands_refresh_parts_search_vector();
