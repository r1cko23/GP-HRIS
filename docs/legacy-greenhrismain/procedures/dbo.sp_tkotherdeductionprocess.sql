
-- =============================================
-- Author:      Pat Relos
-- Create date: 1/8/2026 05:00 PM
-- Description: Process of other deduction from template base to payroll 
-- =============================================
create PROCEDURE [dbo].[sp_tkotherdeductionprocess] 
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

    DECLARE @idpayrollsum       INT;
    DECLARE @countdeductionp   INT = 0;
    DECLARE @countdeductiontk  INT = 0;

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

    ---------------------------------------------------
    -- Count employee with deduction from timekeep
    ---------------------------------------------------
    SELECT 
        @countdeductiontk = COUNT(*)
    FROM tbl_timekeep
    WHERE employeeid     = @idemployee 
      AND idclient        = @idclient 
      AND datestart       = @datestart
      AND ISNULL(totaldeduction, 0) <> 0;

    ---------------------------------------------------
    -- Count existing deduction in payroll
    ---------------------------------------------------
    SELECT 
        @countdeductionp = COUNT(*)
    FROM otherdeduction
    WHERE employee_id        = @idemployee 
      AND idclientdeduction = @idclient 
      AND date_start         = @datestart
      AND codeotherdeduction = 250.12

    ---------------------------------------------------
    -- Transaction
    ---------------------------------------------------
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validate payroll summary exists if there is deduction
        IF @countdeductiontk > 0 AND @idpayrollsum IS NULL
        BEGIN
            RAISERROR('Payroll summary not found for this employee.', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- Insert only if no existing deduction yet
        IF @countdeductionp = 0 AND @totaldeduction <> 0
        BEGIN
            INSERT INTO otherdeduction
            (
                idpayrollsum,
                employee_id,
                date_start,
                date_end,
                idclientdeduction,
                iddepartmentdeduction,
                idloan,
                idloanschedule,
                amount,
				amount2,
				codeotherdeduction,
				particular
				
            )
            VALUES
            (
                @idpayrollsum,
                @idemployee,
                @datestart,
                @dateend,
                @idclient,
                @iddepartment,
                0,
                0,
                @totaldeduction,
				0,
				250.12,
				'Other Deduction'
            );
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000),
                @ErrorSeverity INT,
                @ErrorState INT;

        SELECT 
            @ErrorMessage = ERROR_MESSAGE(),
            @ErrorSeverity = ERROR_SEVERITY(),
            @ErrorState = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END
