import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

async function testAPI() {
  try {
    console.log('Testing API key:', process.env.ANTHROPIC_API_KEY?.substring(0, 20) + '...');
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Say hello' }
      ]
    });
    
    console.log('✅ API test successful:', response.content[0].text);
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.error('Error details:', error);
  }
}

testAPI();
