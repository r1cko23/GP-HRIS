
create PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDmassOTHERDEDANDNETWEEKLY2KBELOW]

    @idclient INT,
    @PayrollPeriodStart DATE,
    @idpayroll INT,
    @idemployee INT
AS
BEGIN

    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    Declare @idpayrollsum6 int
    declare @countempid int

    --;WITH TargetPayroll AS
    --(
    --    SELECT TOP (1)
    --        idpayrollsum
    --    FROM payroll_summary WITH (UPDLOCK, ROWLOCK)
    --    WHERE idclientp = @idclient
    --      AND Date_Start = @PayrollPeriodStart
    --      AND employee_id = @idemployee
    --      AND netamount <= 2000
    --    ORDER BY grossalary DESC
    --)


SELECT @countempid =  COUNT(Employee_id) FROM  payroll_summary where idpayrollsum = @idpayroll and netamount <=2000


if @countempid <>0 
begin

    UPDATE payroll_summary
    SET
        contributionSSSEE = 0,
        contributionSSSER = 0,
        contributionSSSECC = 0,
        contributionSSSEEPRO = 0,
        contributionSSSERPRO = 0,
        contributionphilhealthEE = 0,
        contributionphilhealthER = 0,
        contributionPagibigEE = 0,
        contributionPagibigER = 0,
        withsss = 'N',
        withphi = 'N',
        withpag = 'N',
        withssspro = 'N',
        withtax = 'N',

        Totaldeduction =
            ISNULL(other_deduction,0)
          + ISNULL(wtax,0),

        netamount =
            ISNULL(grossalary,0)
          - (
                ISNULL(other_deduction,0)
              + ISNULL(wtax,0)
            ),

        netamount2 =
            ISNULL(grossalary,0)
          - (
                ISNULL(other_deduction,0)
              + ISNULL(wtax,0)
            )

            where idpayrollsum = @idpayroll

end 


END
