import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

type ActionEmailProps = {
  preview: string;
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  note: string;
};

// แม่แบบอีเมลที่มีปุ่มเดียว ใช้กับยืนยันอีเมลและรีเซ็ตรหัสผ่าน
// อีเมลรองรับ CSS จำกัด จึงใช้ค่าสีตรงๆ แทน Token และฟอนต์ของระบบ
export function ActionEmail({
  preview,
  title,
  body,
  actionLabel,
  actionUrl,
  note,
}: ActionEmailProps) {
  return (
    <Html lang="th">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f5f6f8', fontFamily: 'Tahoma, Arial, sans-serif' }}>
        <Container style={{ margin: '32px auto', maxWidth: 480 }}>
          <Section
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #dce0e7',
              borderRadius: 12,
              padding: 32,
            }}
          >
            <Text style={{ color: '#2753d6', fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>
              BuildCheck
            </Text>
            <Heading style={{ color: '#141820', fontSize: 22, lineHeight: '32px', margin: 0 }}>
              {title}
            </Heading>
            <Text style={{ color: '#4a5361', fontSize: 16, lineHeight: '26px' }}>{body}</Text>
            <Button
              href={actionUrl}
              style={{
                backgroundColor: '#2753d6',
                borderRadius: 8,
                color: '#ffffff',
                display: 'inline-block',
                fontSize: 16,
                fontWeight: 600,
                padding: '12px 24px',
              }}
            >
              {actionLabel}
            </Button>
            <Text style={{ color: '#636d7c', fontSize: 13, lineHeight: '20px', marginBottom: 0 }}>
              {note}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
