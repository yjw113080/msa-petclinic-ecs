if [ -z ${ACCOUNT_ID} ]
then
    echo "Set ACCOUNT_ID first."
else
    aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com

    for i in customers visits vets static
    do
        aws ecr create-repository --repository-name spring-petclinic-"$i"
        docker build -t spring-petclinic-"$i" work/build/spring-petclinic-"$i"-service --build-arg JAR_FILE=spring-petclinic-"$i"-service-2.1.4.jar
        docker tag spring-petclinic-"$i":latest ${ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/spring-petclinic-"$i":latest
        docker push ${ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/spring-petclinic-"$i":latest
    done
fi

