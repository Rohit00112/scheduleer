import {
    Controller,
    Post,
    Body,
    Res,
    Req,
    HttpCode,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
    private readonly logger = new Logger(WhatsappController.name);

    constructor(private readonly whatsappService: WhatsappService) { }

    @Post('webhook')
    @HttpCode(200)
    @ApiOperation({ summary: 'Twilio WhatsApp webhook endpoint' })
    async handleWebhook(
        @Body() body: Record<string, string>,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        // Validate Twilio signature in production
        if (process.env.VALIDATE_TWILIO_SIGNATURE === 'true') {
            const signature = req.headers['x-twilio-signature'] as string;
            const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
            const isValid = this.whatsappService.validateTwilioSignature(
                url,
                body,
                signature || '',
            );
            if (!isValid) {
                this.logger.warn('Invalid Twilio signature');
                res.status(403).send('Forbidden');
                return;
            }
        }

        const from = body.From; // e.g. whatsapp:+1234567890
        const message = body.Body;

        if (!from || !message) {
            res.status(400).send('Missing From or Body');
            return;
        }

        this.logger.log(`Incoming WhatsApp from ${from}: ${message}`);

        const reply = await this.whatsappService.handleIncomingMessage(from, message);

        // Respond with TwiML
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${this.escapeXml(reply)}</Message></Response>`;
        res.type('text/xml').send(twiml);

        // Also send via Twilio API for longer messages that need splitting
        if (reply.length > 1500) {
            await this.whatsappService.sendReply(from, reply);
        }
    }

    @Post('test')
    @HttpCode(200)
    @ApiOperation({ summary: 'Test the bot locally (no Twilio needed)' })
    async testMessage(
        @Body() body: { message: string },
    ): Promise<{ reply: string }> {
        const reply = await this.whatsappService.handleIncomingMessage(
            'test-user',
            body.message,
        );
        return { reply };
    }

    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
