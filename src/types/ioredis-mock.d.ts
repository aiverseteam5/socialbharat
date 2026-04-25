declare module "ioredis-mock" {
  import type IORedis from "ioredis";
  // Constructor signature mirrors ioredis. The implementation is drop-in
  // compatible for BullMQ in unit tests, so we alias to ioredis' `Redis` type.
  const IORedisMock: new (
    ...args: ConstructorParameters<typeof IORedis>
  ) => IORedis;
  export default IORedisMock;
}
