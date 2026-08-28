
-- =============================================
-- Author:		Pat Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	Search Employee List
-- =============================================
CREATE PROCEDURE [dbo].[usp_employeesearchlist] 
	-- Add the parameters for the stored procedure here
	@keytext varchar(50),
	@idorganization int
		
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error

		SELECT employee_id,
			   fname,
			   lname,
			   [status],
			   employee_status,
			   mname = ISNULL(employee.mname, ''),
			   Client.CompanyName,
			   pri_mobile,
			   bankaccountno = ISNULL(employee.bankaccountno, ''),
			   client_branch_position.jobposition
	FROM            Employee INNER JOIN
                         client ON Employee.idclient = client.idclient INNER JOIN
                         client_branch_position ON Employee.Position1 = client_branch_position.idbranchposition

		WHERE employee.tagdelete = 'N'
		 AND employee.idorganization = @idorganization	
		  AND (fname LIKE '%' + @keytext + '%'  		 
			OR lname LIKE '%' + @keytext + '%' 
			OR companyname LIKE '%' + @keytext + '%' 
			OR jobposition LIKE '%' + @keytext + '%' 
			OR bankaccountno LIKE '%' + @keytext + '%' 
			OR employee_id  LIKE '%' + @keytext + '%'
			OR pri_mobile  LIKE '%' + @keytext + '%')
		AND (
        verificationstatus IS NULL
        OR verificationstatus = 'Verified'
      )
		
		ORDER BY lname, fname;

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
