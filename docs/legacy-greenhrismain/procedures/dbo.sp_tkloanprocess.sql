
-- =============================================
-- Author:      Pat Relos
-- Create date: 3/6/2026 05:00 PM
-- Description: Process Loan from set by benefits 
-- =============================================
create PROCEDURE [dbo].[sp_tkloanprocess] 
(
    @idemployee       INT,
    @idclient          INT,
    @iddepartment      INT,
    @datestart         DATE, 
    @dateend           DATE, 
    @totaldeduction    DECIMAL(18,2) 
)
AS
BEGIN
    SET NOCOUNT ON;

	DECLARE @idpayrollsum  INT;
    DECLARE @Particular NVARCHAR(200);
    DECLARE @AmountPaid DECIMAL(18,2);

	---------------------------------------------------
    -- Get payroll summary id
    ---------------------------------------------------
    SELECT TOP (1)  
        @idpayrollsum = idpayrollsum
    FROM payroll_summary
    WHERE employee_id = @idemployee 
      AND idclientp   = @idclient 
      AND date_start  = @datestart
    ORDER BY grossalary DESC;   -- ✔️ make sure column name is correct



    -- Check if employee has unpaid loan on date
    IF EXISTS (
        SELECT 1
        FROM loan
        INNER JOIN loanschedule ON loan.idloan = loanschedule.idloan
        WHERE loan.employee_id = @idemployee
          AND loanschedule.datefrom = @datestart
          AND loanstatus = 'Unpaid'
    )
    BEGIN

        DECLARE loan_cursor CURSOR FOR
        SELECT DISTINCT loan.particular, loanschedule.amount
        FROM loan
        INNER JOIN loanschedule ON loan.idloan = loanschedule.idloan
        WHERE loan.employee_id = @idemployee
          AND loanschedule.datefrom = @datestart
          AND loanstatus = 'Unpaid';

        OPEN loan_cursor;
        FETCH NEXT FROM loan_cursor INTO @Particular, @AmountPaid;

        WHILE @@FETCH_STATUS = 0
        BEGIN

            -- Check if already exists in otherdeduction
            IF NOT EXISTS (
                SELECT 1
                FROM payroll_summary
                INNER JOIN otherdeduction
                    ON payroll_summary.Date_Start = otherdeduction.Date_Start
                    AND payroll_summary.Employee_id = otherdeduction.employee_id
                WHERE payroll_summary.Employee_id = @idemployee
                  AND payroll_summary.Date_Start = @datestart
                  AND otherdeduction.particular = @Particular
            )
            BEGIN

                -- Insert to otherdeduction
                INSERT INTO otherdeduction
                (
                    employee_id,
                    idpayrollsum,
                    particular,
                    idloanschedule,
                    idloan,
                    Date_Start,
                    Date_End,
                    Amount,
                    amount2,
                    idclientdeduction,
                    iddepartmentdeduction
                )
                SELECT
                    loan.employee_id,
                    @idpayrollsum,
                    loan.particular,
                    loanschedule.idloanschedule,
                    loanschedule.idloan,
                    loanschedule.datefrom,
                    loanschedule.dateto,
                    loanschedule.Amount,
                    0,
                    @idclient,
                    @iddepartment
                FROM loanschedule
                INNER JOIN loan ON loanschedule.idloan = loan.idloan
                WHERE loan.employee_id = @idemployee
                  AND loanschedule.datefrom = @datestart
                  AND loan.particular = @Particular
                  AND loanstatus = 'Unpaid';

                -- Update deduction code
                UPDATE od
                SET od.codeotherdeduction = odc.codeotherdeduction
                FROM otherdeduction od
                INNER JOIN otherdeductionclass odc
                    ON od.particular = odc.otherdeduction_desc
                WHERE od.employee_id = @idemployee
                  AND od.date_start = @datestart
                  AND od.particular = @Particular;

                -- Update loan as paid
                UPDATE ls
                SET ls.Amountpaid = @AmountPaid, idpayrollsum = @idpayrollsum
                FROM loan
                INNER JOIN loanschedule ls ON loan.idloan = ls.idloan
                WHERE loan.employee_id = @idemployee
                  AND ls.datefrom = @datestart
                  AND loan.particular = @Particular
                  AND loanstatus = 'Unpaid';

            END

            FETCH NEXT FROM loan_cursor INTO @Particular, @AmountPaid;
        END

        CLOSE loan_cursor;
        DEALLOCATE loan_cursor;

    END
END