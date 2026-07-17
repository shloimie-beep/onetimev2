FROM postgres:18

WORKDIR /ops11
COPY ops11-pg18-production-proof.sh /ops11/ops11-pg18-production-proof.sh
RUN chmod 0755 /ops11/ops11-pg18-production-proof.sh

CMD ["/ops11/ops11-pg18-production-proof.sh"]
