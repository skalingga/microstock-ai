declare module "google-trends-api" {
  const googleTrends: {
    interestOverTime(options: { keyword: string | string[]; geo?: string; startTime?: Date; endTime?: Date }): Promise<string>;
  };
  export default googleTrends;
}
