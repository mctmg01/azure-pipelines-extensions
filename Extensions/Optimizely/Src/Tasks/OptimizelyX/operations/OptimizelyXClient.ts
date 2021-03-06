import * as hm from 'typed-rest-client/Handlers';
import * as restm from 'typed-rest-client/RestClient';
import * as tl from 'azure-pipelines-task-lib/task';

let OptimizelyExperimentStatus: { [status_key: string]: string; } = {
    "Running": "running",
    "NotStarted": "not_started",
    "Paused": "paused"
};

export { OptimizelyExperimentStatus };

export interface OptimizelyProject {
    id: string;
    name: string;
    platform: string;
}

export interface IOptimizelyVariation {
    name: string;
    key: string;
    weight: number;
}

export interface IOptimizelyAlphaBetaTest {
    id: string;
    name: string;
    key: string;
    status: string;
    variations: Array<IOptimizelyVariation>;
    environments: any;
    holdback: number;
    type: string;
    audience_conditions: string;
}

export interface IOptimizelyEnvironment {
    id: string;
    name: string;
    key: string;
}

export interface IOptimizelyAudience {
    id: string;
    name: string;
}

export interface IOptimizelyFeature {
    id: string;
    key: string;
    variables: Array<IOptimizelyVariable>
    environments: any;
}

export interface IOptimizelyVariable {
    key: string;
    type: string;
    default_value: string;
}

export class OptimizelyXClient {
    private restClient: restm.RestClient;

    constructor (url: string, pat: string, userAgent: string) {

        if (!userAgent) {
            userAgent = "AzDevOps_OptimizelyX";
        }

        let token: string = "";
        if (pat.startsWith('Bearer ')) {
            token = pat.replace("Bearer ", "");
        } else if (pat.startsWith('bearer ')) {
            token = pat.replace("bearer ", "");
        } else {
            token = pat;
        }

        // optimizely rest api uses pat as bearer token. So instead of using the patcredhandler here, we are using bearercredhandler.
        const bearerHandler = new hm.BearerCredentialHandler(token);
        this.restClient = new restm.RestClient(userAgent, url, [bearerHandler]);
    }

    public async getProject<T extends OptimizelyProject>(projectId: string): Promise<T> {
        let projects = await this.getProjects();
        let selectedProject = null;
        projects.forEach((project) => {
            if (project.id == projectId.toLowerCase()) {
                selectedProject = project;
            }
        });

        if (selectedProject === null) {
            throw tl.loc("ProjectNotFound");
        }

        console.log(tl.loc("ProjectHasProjectId", selectedProject.name, selectedProject.id));

        return selectedProject;
    }

    public async getExperiment<T extends IOptimizelyAlphaBetaTest>(projectId: string, experimentId: string): Promise<T> {
        let restRes: restm.IRestResponse<T> = await this.restClient.get<T>(`experiments/${experimentId}`);
        tl.debug(`function: 'getExperiment'. response: '${JSON.stringify(restRes)}'`);
        let experiment = restRes.result;
        return experiment;
    }

    public async updateExperiment<T extends IOptimizelyAlphaBetaTest>(experimentId: string, experiment: T) {
        let restRes = await this.restClient.update(`experiments/${experimentId}`, experiment);
        tl.debug(`function: 'updateExperiment'. response: '${JSON.stringify(restRes)}'`);

        if (restRes.statusCode != 200) {
            tl.debug(`Unable to updated experiment with Id: '${experimentId}'. Response:`);
            tl.debug(JSON.stringify(restRes));
            throw tl.loc("FailedToUpdatedExperiment", experimentId);
        }

        console.log(tl.loc("ExperimentWithIdUpdatedSuccessfully", experimentId));
    }

    public async getFeature<T extends IOptimizelyFeature>(featureId: string): Promise<T> {
        let restRes: restm.IRestResponse<T> = await this.restClient.get<T>(`features/${featureId}`);
        tl.debug(`function: 'getFeature'. response: '${JSON.stringify(restRes)}'`);
        let feature = restRes.result;
        return feature;
    }

    public async updateFeature<T extends IOptimizelyFeature>(featureId: string, feature: T) {
        let restRes = await this.restClient.update(`features/${featureId}`, feature);
        tl.debug(`function: 'updateFeature'. response: '${JSON.stringify(restRes)}'`);

        if (restRes.statusCode != 200) {
            tl.debug(`Unable to updated feature with Id: '${featureId}'. Response:`);
            tl.debug(JSON.stringify(restRes));
            throw tl.loc("FailedToUpdatedFeature", featureId);
        }

        console.log(tl.loc("FeatureWithIdUpdatedSuccessfully", featureId));
    }

    public async getEnvironment<T extends IOptimizelyEnvironment>(projectId: string, environmentName: string): Promise<T> {
        let restRes = await this.restClient.get<Array<T>>(`environments?project_id=${projectId}`);
        tl.debug(`function: 'getEnvironment'. response: '${JSON.stringify(restRes)}'`);
        let result = null;

        if (restRes.statusCode != 200) {
          throw tl.loc("FailedToFetchEnvironment", environmentName);
        }

        restRes.result.forEach((optimizelyEnvironment) => {
            if (optimizelyEnvironment.key.toLocaleLowerCase() === environmentName.toLowerCase()) {
                result = optimizelyEnvironment;
            }
        });

        return result;
    }

    public async getAudienceId<T extends IOptimizelyAudience>(projectId: string, audienceName: string): Promise<number> {
        console.log(tl.loc("FetchingAudienceId", audienceName));
        let restRes = await this.restClient.get<Array<T>>(`audiences?project_id=${projectId}`);
        tl.debug(`function: 'getAudienceId'. Response: '${JSON.stringify(restRes)}'`);
        let audienceId: number = null;

        if (restRes.statusCode != 200) {
          throw tl.loc("FailedToFetchAudience", audienceName);
        }

        restRes.result.forEach((optimizelyAudience) => {
            if (optimizelyAudience.name.toLowerCase() == audienceName.toLowerCase()) {
                audienceId = Number.parseInt(optimizelyAudience.id);
                tl.debug(`Audience name: '${audienceName}', Audience Id: '${audienceId}'`);
            }
        });

        if (audienceId == null) {
            throw tl.loc("UnableToFindAudience", audienceName);
        }

        return audienceId;
    }

    private async getProjects<T extends OptimizelyProject>(): Promise<Array<T>> {
        let restRes: restm.IRestResponse<Array<T>> = await this.restClient.get<Array<T>>('projects');
        tl.debug(`function: 'getProjects'. response: '${JSON.stringify(restRes)}'`);

        if (restRes.statusCode != 200) {
          throw tl.loc("FailedToFetchProjects");
        }

        return restRes.result;
    }

    private async getExperiments<T extends IOptimizelyAlphaBetaTest>(projectId: string): Promise<Array<T>> {
        let restRes: restm.IRestResponse<Array<T>> = await this.restClient.get<Array<T>>(`experiments?project_id=${projectId}`);
        tl.debug(`function: 'getExperiments'. response: '${JSON.stringify(restRes)}'`);

        if (restRes.statusCode != 200) {
          throw tl.loc("FailedToFetchExperiments");
        }

        return restRes.result;
    }
}
