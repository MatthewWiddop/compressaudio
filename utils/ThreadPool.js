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

    createWorker() {
        const worker = new Worker(this.config.filename);
        
        worker.on('message', ({ data, error }) => {
            // check for error
            if(error) {
                worker.activeTask.reject(error);
            }
            else
            { // return result
                worker.activeTask.resolve(data);
            }
            // get new task if available
            if (!this.processNextTask(worker)) {
                this.activeWorkers.delete(worker);
            }
        });

        worker.on('error', (err) => {
            console.error('Error:', err);
        });

        return worker;
    }

    assignTask(worker, taskDetails) {
        this.activeWorkers.add(worker);
        worker.activeTask = taskDetails;
        worker.postMessage(taskDetails.task);
    }

    addTask(task) {
        return new Promise((resolve, reject) => {
            const taskDetails = {
                task,
                resolve,
                reject
            };
            
            const availableWorker = this.getAvailableWorker();
            if (availableWorker) {
                this.assignTask(availableWorker, taskDetails)
            }
            else
            {
                this.tasks.push(taskDetails);
            }
        });
    }

    getAvailableWorker() {
        const worker = this.workers.find((worker) => !this.activeWorkers.has(worker));
        if(worker) {
            return worker;
        }
        return false;
    }

    processNextTask(worker) {
        if(this.tasks.length == 0) return false;
        const taskDetails = this.tasks.shift();
        this.assignTask(worker, taskDetails);
    }

    async exit() {
        const remainingPromises = Array.from(this.activeWorkers.values())
            .map((worker) => new Promise((resolve) => {
                worker.activeTask.resolve = (result) => {
                    worker.activeTask.resolve(result);
                    resolve()
                }
            })
        );

        const output = await Promise.all(remainingPromises);
        console.log(output)
        
        this.workers.map((worker) => {
            worker.terminate();
        })
        this.workers = []
        this.tasks = []
    }
}

module.exports = ThreadPool;