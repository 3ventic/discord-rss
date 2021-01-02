import NodePersist, { LocalStorage } from "node-persist";
import { DBName } from "./const";

class Storage {
  private strg: LocalStorage;
  constructor() {
    this.strg = NodePersist.create({ dir: "/tmp/appdata" });
  }

  public build = async () => {
    if (!(await this.strg.getItem(DBName))) {
      this.strg.setItem(DBName, []);
    }
  };

  get storage(): LocalStorage {
    return this.strg;
  }
}

let instance: Storage = new Storage();
instance.build();
export default instance.storage;
