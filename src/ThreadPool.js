const { Worker } = require('worker_threads');

class ThreadPool {
  constructor(config) {
    this.validateConfig(config);
    this.config = {
      filename: config.filename,
      size: config.size || 4
    }

    this.workers = [];
    this.activeWorkers = new Set();
    this.tasks = [];
    this.initialise();
  }

  validateConfig(config) {
    if(!config.filename) {
      throw new Error('File path must be given');
    }
    if(config.size && (!Number.isInteger(config.size) || config.size < 0)) {
      throw new Error('Size must be greater than 0');
    }
  }

  initialise() {
    for(let idx = 0; idx < this.config.size; idx++) {
      this.workers.push(this.createWorker());
    }
  }

  rejectTask(worker, error) {
    const activeTask = worker.activeTask;
    worker.activeTask = null;
    activeTask.reject(error);
  }

  resolveTask(worker, data) {
    const activeTask = worker.activeTask;
    worker.activeTask = null;
    activeTask.resolve(data);
  }

  createWorker() {
    const worker = new Worker(this.config.filename);

    worker.on('message', resp => {
      if (resp.error) {
        const error = new Error(resp.error);
        this.rejectTask(worker, error);
      }
      else {
        this.resolveTask(worker, resp.data);
      }

      if (!this.processNextTask(worker)) {
        this.activeWorkers.delete(worker);
      }
    });

    worker.on('error', err => {
      if (worker.activeTask) {
        this.rejectTask(worker, err);
      }
      this.removeWorker(worker);
      this.workers.push(this.createWorker());
    });

    return worker;
  }

  removeWorker(worker) {
    const workerIdx = this.workers.indexOf(worker);
    if (workerIdx == -1) {
      return;
    }
    this.workers.splice(workerIdx, 1);
    this.activeWorkers.delete(worker);
    worker.terminate();
  }

  assignTask(worker, taskDetails) {
    this.activeWorkers.add(worker);
    worker.activeTask = taskDetails;
    worker.postMessage(taskDetails.task);
  }

  addTask(task) {
    return new Promise((resolve, reject) => {
      const taskDetails = { task, resolve, reject };
      const availableWorker = this.getAvailableWorker();
      if (availableWorker) {
        this.assignTask(availableWorker, taskDetails);
      }
      else
      {
        this.tasks.push(taskDetails);
      }
    });
  }

  getAvailableWorker() {
    const worker = this.workers.find((worker) => !this.activeWorkers.has(worker));
    return worker || false;
  }

  processNextTask(worker) {
    if (this.tasks.length == 0) {
      return false;
    }
    const taskDetails = this.tasks.shift();
    this.assignTask(worker, taskDetails);
  }

  async exit() {
    const remainingPromises = Array
      .from(this.activeWorkers.values())
      .map((worker) => new Promise((resolve) => {
        worker.activeTask.resolve = (result) => {
          worker.activeTask.resolve(result);
          resolve();
        }
      }));
    
    await Promise.all(remainingPromises);

    this.workers.map((worker) => {
      worker.terminate();
    })
    this.workers = [];
    this.tasks = [];
  }
}

module.exports = ThreadPool;

