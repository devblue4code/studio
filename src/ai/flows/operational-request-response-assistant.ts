'use server';
/**
 * @fileOverview An AI-powered assistant to help administrators draft responses and status updates for operational requests.
 *
 * - operationalRequestResponseAssistant - A function that handles the generation of draft responses for operational requests.
 * - OperationalRequestResponseAssistantInput - The input type for the operationalRequestResponseAssistant function.
 * - OperationalRequestResponseAssistantOutput - The return type for the operationalRequestResponseAssistant function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OperationalRequestResponseAssistantInputSchema = z.object({
  requestType: z.string().describe('The type of operational request (e.g., "Leave Request", "Vacation Request", "Service Exchange Request").'),
  requestDetails: z.string().describe('The full details of the employee\'s request.'),
  employeeName: z.string().describe('The name of the employee who submitted the request.'),
  currentStatus: z.string().describe('The current status of the request (e.g., "Pending", "Approved", "Denied", "In Review").'),
  adminNotes: z.string().optional().describe('Optional internal notes from the administrator that might influence the response.'),
});
export type OperationalRequestResponseAssistantInput = z.infer<typeof OperationalRequestResponseAssistantInputSchema>;

const OperationalRequestResponseAssistantOutputSchema = z.object({
  suggestedResponse: z.string().describe('A draft response or status update suggested by the AI.'),
  nextSteps: z.string().optional().describe('Optional suggested next steps for the administrator regarding this request.'),
});
export type OperationalRequestResponseAssistantOutput = z.infer<typeof OperationalRequestResponseAssistantOutputSchema>;

export async function operationalRequestResponseAssistant(input: OperationalRequestResponseAssistantInput): Promise<OperationalRequestResponseAssistantOutput> {
  return operationalRequestResponseAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'operationalRequestResponseAssistantPrompt',
  input: { schema: OperationalRequestResponseAssistantInputSchema },
  output: { schema: OperationalRequestResponseAssistantOutputSchema },
  prompt: `You are an AI-powered assistant for an administrator managing employee operational requests. Your goal is to suggest a draft response or a status update for a given request, ensuring consistent and quick communication.

Here are the details of the request:
Request Type: {{{requestType}}}
Employee Name: {{{employeeName}}}
Request Details: {{{requestDetails}}}
Current Status: {{{currentStatus}}}

{{#if adminNotes}}
Administrator Notes: {{{adminNotes}}}
{{/if}}

Based on the information above, draft a professional and clear response or status update. If the request is pending, you might suggest acknowledging receipt or asking for more information. If it's approved or denied, clearly state the outcome and any relevant details. Also, suggest any immediate next steps the administrator should take.

Ensure the tone is appropriate for formal communication within a professional setting.`,
});

const operationalRequestResponseAssistantFlow = ai.defineFlow(
  {
    name: 'operationalRequestResponseAssistantFlow',
    inputSchema: OperationalRequestResponseAssistantInputSchema,
    outputSchema: OperationalRequestResponseAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
