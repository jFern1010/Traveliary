import { fitWithin } from '@/features/capture/image-size';

describe('fitWithin', () => {
  it('scales a portrait photo by its height', () => {
    expect(fitWithin({ width: 3024, height: 4032 }, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('scales a landscape photo by its width', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, 400)).toEqual({ width: 400, height: 300 });
  });

  it('never upscales small images', () => {
    expect(fitWithin({ width: 800, height: 600 }, 1600)).toEqual({ width: 800, height: 600 });
  });
});
