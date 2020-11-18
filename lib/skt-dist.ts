import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecr from '@aws-cdk/aws-ecr';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';
import * as logs from '@aws-cdk/aws-logs';
import * as iam from '@aws-cdk/aws-iam';
import * as ecrAsset from '@aws-cdk/aws-ecr-assets';

import { CfnOutput, Duration, StackProps, CfnParameter} from '@aws-cdk/core';
import { ListenerAction, ListenerCertificate, ListenerCondition } from '@aws-cdk/aws-elasticloadbalancingv2';

export class SktDistStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const vpcId = new CfnParameter(this, "vpcId", {
      type: "String",
      description: "VPC ID where the cluter exists"
  });

  const publicSubnet1 = new CfnParameter(this, "publicSubnet1", {
      type: "String",
      description: "Subnet ID of Public Subnet"
  });
  const publicSubnet2 = new CfnParameter(this, "publicSubnet2", {
      type: "String",
      description: "Subnet ID of Public Subnet"
  });
  const privateSubnet1 = new CfnParameter(this, "privateSubnet1", {
      type: "String",
      description: "Subnet ID of private Subnet"
  });
  const privateSubnet2 = new CfnParameter(this, "privateSubnet2", {
      type: "String",
      description: "Subnet ID of Public Subnet"
  });

  const rdsEndpointUrl = new CfnParameter(this, 'rds-endpoint', {
    type: 'String',
    description: 'RDS Endpoint'
  })

  const vpc = ec2.Vpc.fromVpcAttributes(this, 'existing-vpc', {
    vpcId: vpcId.valueAsString,
    availabilityZones: ['ap-northeast-2a','ap-northeast-2b'],
    publicSubnetIds: [publicSubnet1.valueAsString, publicSubnet2.valueAsString],
    privateSubnetIds: [privateSubnet1.valueAsString, privateSubnet2.valueAsString]
})


  const cluster = new ecs.Cluster(this, 'skt-poc-cluster',{
    containerInsights: true,
    vpc
  });

  const ec2Provider = cluster.addCapacity('default-ec2',{
    instanceType: new ec2.InstanceType('m5d.large'),
    minCapacity: 2,
    maxCapacity: 10
  });

  const spotProvider = cluster.addCapacity('spot-ec2', {
    instanceType: new ec2.InstanceType('m5.large'),
    spotPrice: '0.032'
  })

  ec2Provider.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'));

  ec2Provider.scaleOnCpuUtilization('default-cpu-scaling-policy', {
    targetUtilizationPercent: 50
  })

  const lb = new elb.ApplicationLoadBalancer(this, 'alb', {
    vpc: cluster.vpc,
    internetFacing: true
  });
  const listener = lb.addListener('default', { port: 80 });

  const ecsLogGroup = new logs.LogGroup(this, 'skt-ecs-poc-log-group');

  let components: Array<string> = ['customers', 'vets', 'visits', 'static'];

  for (var i in components) {
    let s = components[i];
    // let asset = new ecrAsset.DockerImageAsset(this, `spring-petclinic-${s}`, {
    //   directory: `./work/build/spring-petclinc-${s}-service`,
    //   buildArgs: {
    //     JAR_FILE: `spring-petclinic-${s}-service-2.1.4.jar`
    //   }
    // });

    let td = new ecs.Ec2TaskDefinition(this, `td-${s}`);
    let env = {}

    if (s != 'static') {
      env = {
        'SPRING_DATASOURCE_PASSWORD': 'petclinic',
        'SPRING_DATASOURCE_USERNAME': 'root',
        'SPRING_PROFILES_ACTIVE': 'mysql',
        'SPRING_DATASOURCE_URL': `jdbc:mysql://${rdsEndpointUrl.valueAsString}:3306/petclinic?useUnicode=true`,
        'SERVER_SERVLET_CONTEXT_PATH': `/api/${s.slice(0, -1)}`
      }
    }

    let ecrRepo = ecr.Repository.fromRepositoryName(this, `repo-${s}`, `spring-petclinic-${s}`)
    td.addContainer(`container-${s}`, {
      memoryLimitMiB: 512,
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo),
      logging: ecs.LogDrivers.firelens({options: {
        Name: 'cloudwatch',
        region: cdk.Stack.of(this).region,
        log_stream_prefix: 'from-fluent-bit',
        log_group_name: ecsLogGroup.logGroupName
      }}),
      environment: env
    }).addPortMappings({containerPort: 8080})

    let svc = new ecs.Ec2Service(this, `service-${s}`, {
      cluster,
      // serviceName: `spring-petclinic-${s}`,
      desiredCount: 1,
      taskDefinition: td
    })

    let pattern, priority, check;

    if (s == 'static') {
      pattern = '/*';
      priority = 1100;
      check = {'path': '/'}
    } else {
      pattern = `/api/${s.slice(0, -1)}/*`;
      priority = getRandomInt(1, 1000);
      check = {
        'path': `/api/${s.slice(0, -1)}/manage`
      }
    }


    if (s == 'static') {
      svc.registerLoadBalancerTargets({
        containerName: `container-${s}`,
        containerPort: 8080,
        newTargetGroupId: `tg-${s}`,
        listener: ecs.ListenerConfig.applicationListener(listener, {
          protocol: elb.ApplicationProtocol.HTTP
        })
    })
    

  } else {

    let tg = new elb.ApplicationTargetGroup(this, `tg-${s}`, {
      protocol: elb.ApplicationProtocol.HTTP,
      vpc,
      healthCheck: check,
      port: 80,
      targets: [svc]
    })

    // listener.addTargetGroups(`ecs-${s}`, {
    //   pathPattern: pattern,
    //   priority,
    //   targetGroups: [tg]
    // })
    listener.addAction(`rule-${s}`, {
      priority,
      conditions: [ListenerCondition.pathPatterns([pattern])],
      action: ListenerAction.forward([tg])
    })

  }

}}}
function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //최댓값은 제외, 최솟값은 포함
}
