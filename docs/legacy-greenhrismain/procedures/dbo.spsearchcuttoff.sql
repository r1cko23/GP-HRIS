
-- =============================================
-- Author:		Pat Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	Search Employee List
-- =============================================
CREATE PROCEDURE [dbo].[spsearchcuttoff] 
	-- Add the parameters for the stored procedure here
	@idclient Int, 
	@iddepartment int,
	@datestart date,
	@trxtype nvarchar(20),
	@frequencypayment nvarchar(20)

	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error
			select idclientp, 
			department_codep, 
			Date_Start, 
			Date_End,
			payrolldate,
			payrollmonth,
			payrollmonthsort, 
			payrollyear,
			trxtypep
			
			FROM payroll_summary WHERE idclientp =  @idclient 
			and department_codep = @iddepartment 
			and Date_Start = @datestart	and trxtypep =@trxtype
			AND payroll_summary.frequencypayment = @frequencypayment
		
		COMMIT TRANSACTION; -- Commit the transaction if everything is successful
	
	END TRY
	BEGIN CATCH
		IF @@TRANCOUNT > 0
			ROLLBACK TRANSACTION; -- Rollback the transaction in case of an error

		-- Log or handle the error as per your requirements
		-- Example: Raising an error and returning the error message to the caller
		DECLARE @ErrorMessage NVARCHAR(4000);
		DECLARE @ErrorSeverity INT;
		DECLARE @ErrorState INT;

		SELECT 
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
		RETURN;
	END CATCH;
END
