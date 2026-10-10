import { AppConfiguration } from '../Core/AppConfiguration';

export class About {
  public static getAboutInfo() {
    const appConfig = AppConfiguration.getInstance();
    return {
      name: appConfig.metadata.name,
      version: appConfig.metadata.version,
      description: appConfig.metadata.description,
      disclaimer:
        'FSEB is an independent, authorized examination browser and is not affiliated with or endorsed by Safe Exam Browser (ETH Zurich).',
    };
  }
}

