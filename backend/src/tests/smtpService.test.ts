import { SmtpService } from '../services/smtpService';
import { config } from '../config/env';
import nodemailer from 'nodemailer';

/**
 * Automated Verification Test for SmtpService:
 * 1. Confirms Real SMTP mode dispatches via nodemailer and returns null previewUrl (no fake URLs).
 * 2. Confirms Fake SMTP mode returns local web viewer URL.
 * 3. Confirms that Real SMTP send failures throw genuine errors rather than faking delivery receipts.
 */
async function runSmtpTests() {
  console.log('========================================================');
  console.log('🧪 Running SmtpService Real vs Fake Mode Verification Tests');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Real SMTP Mode
  totalTests++;
  try {
    const service = new SmtpService();
    const mockInfo = {
      messageId: '<real-smtp-msg-123@reachinbox.ai>',
      response: '250 2.0.0 OK: message queued for real delivery',
    };

    const originalCreateTransport = nodemailer.createTransport;
    const originalMode = config.SMTP_MODE;
    const originalUser = config.SMTP_USER;
    const originalPass = config.SMTP_PASS;

    (config as any).SMTP_MODE = 'real';
    (config as any).SMTP_USER = 'test@example.com';
    (config as any).SMTP_PASS = 'secret123';

    (nodemailer as any).createTransport = () => ({
      sendMail: async () => mockInfo,
    });

    await service.init();
    const result = await service.sendEmail({
      from: 'test@example.com',
      to: 'recipient@domain.com',
      subject: 'Real Delivery Test',
      text: 'Testing real SMTP delivery mode',
    });

    if (result.deliveryMode === 'REAL_SMTP' && result.previewUrl === null && result.messageId === mockInfo.messageId) {
      console.log('✅ Test 1 Passed: Real SMTP mode correctly returns deliveryMode="REAL_SMTP" with previewUrl=null');
      passedTests++;
    } else {
      console.error('❌ Test 1 Failed: Expected REAL_SMTP, got', result);
    }

    // Restore
    (nodemailer as any).createTransport = originalCreateTransport;
    (config as any).SMTP_MODE = originalMode;
    (config as any).SMTP_USER = originalUser;
    (config as any).SMTP_PASS = originalPass;
  } catch (err: any) {
    console.error('❌ Test 1 Exception:', err.message);
  }

  // Test 2: Fake SMTP Mode
  totalTests++;
  try {
    const service = new SmtpService();
    const originalMode = config.SMTP_MODE;
    (config as any).SMTP_MODE = 'fake';

    await service.init();
    const result = await service.sendEmail({
      emailId: 'test-email-job-456',
      from: 'growth@reachinbox.ai',
      to: 'client@example.com',
      subject: 'Fake SMTP Sandbox Test',
      text: 'Testing local sandbox',
    });

    if (result.deliveryMode === 'FAKE_SMTP' && result.previewUrl?.includes('/preview')) {
      console.log('✅ Test 2 Passed: Fake SMTP mode correctly captures email into local web viewer');
      passedTests++;
    } else {
      console.error('❌ Test 2 Failed:', result);
    }

    (config as any).SMTP_MODE = originalMode;
  } catch (err: any) {
    console.error('❌ Test 2 Exception:', err.message);
  }

  // Test 3: Real SMTP Error Propagation
  totalTests++;
  try {
    const service = new SmtpService();
    const mockError = new Error('535-5.7.8 Username and Password not accepted');

    const originalCreateTransport = nodemailer.createTransport;
    const originalMode = config.SMTP_MODE;
    (config as any).SMTP_MODE = 'real';
    (config as any).SMTP_USER = 'test@example.com';
    (config as any).SMTP_PASS = 'invalid-pass';

    (nodemailer as any).createTransport = () => ({
      sendMail: async () => {
        throw mockError;
      },
    });

    await service.init();
    let threw = false;
    try {
      await service.sendEmail({
        from: 'test@example.com',
        to: 'client@example.com',
        subject: 'Auth Failure Test',
        text: 'Testing auth error',
      });
    } catch (e: any) {
      threw = true;
      if (e.message.includes('535-5.7.8')) {
        console.log('✅ Test 3 Passed: Real SMTP errors are strictly thrown and never faked');
        passedTests++;
      } else {
        console.error('❌ Test 3 Failed: Unexpected error:', e.message);
      }
    }

    if (!threw) {
      console.error('❌ Test 3 Failed: sendEmail should have thrown');
    }

    (nodemailer as any).createTransport = originalCreateTransport;
    (config as any).SMTP_MODE = originalMode;
  } catch (err: any) {
    console.error('❌ Test 3 Exception:', err.message);
  }

  console.log(`\n========================================================`);
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  console.log('========================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSmtpTests();
